package uz.dtwin.teletwin;

import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.util.Log;
import android.widget.Toast;
import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.content.FileProvider;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * Self-update from the TeleTwin update channel (teletwin docs/client-contract.md "Auto-update channel"):
 * GET /api/updates/android?current=versionName answers 200 with {version, url, sha256} when a newer APK
 * is published, 204 otherwise. The APK is installed only when its SHA-256 matches the channel's value.
 */
final class AppUpdater {

    static final String CHANNEL = "https://tele.dtwin.uz/api/updates/android?current=";
    private static final String TAG = "TeleTwinUpdater";
    private static final String PREFS = "teletwin";
    private static final String PREF_LAST_CHECK = "updateLastCheck";
    private static final long CHECK_INTERVAL_MS = 24L * 60 * 60 * 1000;
    private static final int TIMEOUT_MS = 15_000;

    private final AppCompatActivity activity;
    private final ExecutorService io = Executors.newSingleThreadExecutor();
    private volatile boolean busy;

    AppUpdater(AppCompatActivity activity) {
        this.activity = activity;
    }

    /** On start always, afterwards at most once per 24 hours. */
    void checkIfDue(boolean force) {
        SharedPreferences prefs = activity.getSharedPreferences(PREFS, AppCompatActivity.MODE_PRIVATE);
        long now = System.currentTimeMillis();
        if (busy || (!force && now - prefs.getLong(PREF_LAST_CHECK, 0) < CHECK_INTERVAL_MS)) return;
        prefs.edit().putLong(PREF_LAST_CHECK, now).apply();
        busy = true;
        String current = currentVersion();
        io.execute(() -> {
            try {
                JSONObject update = fetch(CHANNEL + Uri.encode(current));
                if (update != null) activity.runOnUiThread(() -> offer(update));
            } catch (IOException | JSONException e) {
                Log.w(TAG, "Update check failed", e);
            } finally {
                busy = false;
            }
        });
    }

    private String currentVersion() {
        try {
            PackageInfo info = activity.getPackageManager().getPackageInfo(activity.getPackageName(), 0);
            return info.versionName != null ? info.versionName : "0.0.0";
        } catch (PackageManager.NameNotFoundException e) {
            return "0.0.0";
        }
    }

    /** null when up to date (204) or the answer is not usable. */
    private static JSONObject fetch(String url) throws IOException, JSONException {
        HttpURLConnection connection = (HttpURLConnection) new URL(url).openConnection();
        connection.setConnectTimeout(TIMEOUT_MS);
        connection.setReadTimeout(TIMEOUT_MS);
        try {
            if (connection.getResponseCode() != HttpURLConnection.HTTP_OK) return null;
            ByteArrayOutputStream body = new ByteArrayOutputStream();
            try (InputStream in = connection.getInputStream()) {
                copy(in, body, null);
            }
            JSONObject update = new JSONObject(new String(body.toByteArray(), StandardCharsets.UTF_8));
            if (!isTrustedUrl(update.optString("url")) || !isSha256(update.optString("sha256"))) return null;
            return update;
        } finally {
            connection.disconnect();
        }
    }

    private void offer(JSONObject update) {
        if (activity.isFinishing()) return;
        String version = update.optString("version");
        new AlertDialog.Builder(activity)
            .setTitle(R.string.update_title)
            .setMessage(activity.getString(R.string.update_message, version, currentVersion()))
            .setPositiveButton(R.string.update_install, (dialog, which) -> download(update))
            .setNegativeButton(R.string.update_later, null)
            .show();
    }

    private void download(JSONObject update) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !activity.getPackageManager().canRequestPackageInstalls()) {
            // The user allows "Install unknown apps" for TeleTwin once; the next check offers the update again.
            toast(activity.getString(R.string.update_allow_install));
            activity.getSharedPreferences(PREFS, AppCompatActivity.MODE_PRIVATE).edit().remove(PREF_LAST_CHECK).apply();
            activity.startActivity(
                new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + activity.getPackageName()))
            );
            return;
        }
        toast(activity.getString(R.string.update_downloading));
        String url = update.optString("url");
        String expected = update.optString("sha256").toLowerCase(Locale.ROOT);
        io.execute(() -> {
            File dir = new File(activity.getCacheDir(), "updates");
            File apk = new File(dir, "TeleTwin-update.apk");
            try {
                if (!dir.isDirectory() && !dir.mkdirs()) throw new IOException("cannot create " + dir);
                String actual = downloadTo(url, apk);
                if (!expected.equals(actual)) {
                    Log.w(TAG, "SHA-256 mismatch: expected " + expected + ", got " + actual);
                    //noinspection ResultOfMethodCallIgnored
                    apk.delete();
                    activity.runOnUiThread(() -> toast(activity.getString(R.string.update_checksum_failed)));
                    return;
                }
                activity.runOnUiThread(() -> install(apk));
            } catch (IOException e) {
                Log.w(TAG, "Update download failed", e);
                activity.runOnUiThread(() -> toast(activity.getString(R.string.update_failed)));
            }
        });
    }

    /** Streams url into file and returns the file's SHA-256 (lower-case hex). */
    private static String downloadTo(String url, File file) throws IOException {
        MessageDigest digest;
        try {
            digest = MessageDigest.getInstance("SHA-256");
        } catch (NoSuchAlgorithmException e) {
            throw new IOException(e);
        }
        HttpURLConnection connection = (HttpURLConnection) new URL(url).openConnection();
        connection.setConnectTimeout(TIMEOUT_MS);
        connection.setReadTimeout(60_000);
        try {
            if (connection.getResponseCode() != HttpURLConnection.HTTP_OK) {
                throw new IOException("HTTP " + connection.getResponseCode());
            }
            try (InputStream in = connection.getInputStream(); OutputStream out = new FileOutputStream(file)) {
                copy(in, out, digest);
            }
        } finally {
            connection.disconnect();
        }
        return hex(digest.digest());
    }

    private void install(File apk) {
        Uri uri = FileProvider.getUriForFile(activity, activity.getPackageName() + ".fileprovider", apk);
        Intent intent = new Intent(Intent.ACTION_VIEW)
            .setDataAndType(uri, "application/vnd.android.package-archive")
            .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
        activity.startActivity(intent);
    }

    private void toast(String text) {
        Toast.makeText(activity, text, Toast.LENGTH_LONG).show();
    }

    private static void copy(InputStream in, OutputStream out, MessageDigest digest) throws IOException {
        byte[] buffer = new byte[64 * 1024];
        int read;
        while ((read = in.read(buffer)) != -1) {
            out.write(buffer, 0, read);
            if (digest != null) digest.update(buffer, 0, read);
        }
    }

    /** Only our own download host may serve the APK. */
    static boolean isTrustedUrl(String url) {
        return url.startsWith("https://tele.dtwin.uz/download/") || url.startsWith("https://dtwin.uz/teletwin/download/");
    }

    static boolean isSha256(String value) {
        return value.matches("(?i)[0-9a-f]{64}");
    }

    static String hex(byte[] bytes) {
        StringBuilder out = new StringBuilder(bytes.length * 2);
        for (byte b : bytes) out.append(String.format(Locale.ROOT, "%02x", b));
        return out.toString();
    }
}
