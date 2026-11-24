package it.quadratoufficiali.registro;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.provider.MediaStore;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import androidx.core.content.FileProvider;
import androidx.webkit.WebViewAssetLoader;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

/**
 * Mostra l'app del Registro (inclusa nell'APK, cartella assets/www) a schermo intero.
 * Le pagine vengono servite dall'indirizzo sicuro https://appassets.androidplatform.net,
 * così archivio dati (IndexedDB) e password funzionano come nel browser, ma senza internet.
 */
public class MainActivity extends Activity {

    private static final String HOST = "appassets.androidplatform.net";
    private static final String START_URL = "https://" + HOST + "/assets/www/index.html";
    private static final int REQ_FILE = 1;
    private static final int REQ_SAVE = 2;

    private WebView web;
    private ValueCallback<Uri[]> fileCallback;
    private Uri cameraUri;
    private byte[] pendingSave;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        web = new WebView(this);
        web.setBackgroundColor(0xFF070B16);
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(false);
        s.setTextZoom(100);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);

        final WebViewAssetLoader loader = new WebViewAssetLoader.Builder()
                .setDomain(HOST)
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();

        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return loader.shouldInterceptRequest(request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (HOST.equals(uri.getHost())) return false;
                openExternal(uri);
                return true;
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                return showFileChooser(callback, params);
            }
        });

        web.addJavascriptInterface(new Bridge(), "QuadratoAndroid");
        web.loadUrl(START_URL);
    }

    /* ------------------------- scelta file / foto ------------------------- */

    private boolean showFileChooser(ValueCallback<Uri[]> callback, WebChromeClient.FileChooserParams params) {
        if (fileCallback != null) fileCallback.onReceiveValue(null);
        fileCallback = callback;
        cameraUri = null;

        boolean image = false;
        String[] types = params.getAcceptTypes();
        if (types != null) {
            for (String t : types) {
                if (t != null && t.startsWith("image")) image = true;
            }
        }

        Intent pick = new Intent(Intent.ACTION_GET_CONTENT);
        pick.addCategory(Intent.CATEGORY_OPENABLE);
        pick.setType(image ? "image/*" : "*/*");
        Intent chooser = Intent.createChooser(pick, image ? "Scegli una foto" : "Scegli un file");

        if (image) {
            // Proposta anche la fotocamera: la foto viene salvata in un file temporaneo dell'app.
            try {
                File dir = new File(getCacheDir(), "foto");
                if (!dir.exists()) dir.mkdirs();
                File f = File.createTempFile("foto", ".jpg", dir);
                cameraUri = FileProvider.getUriForFile(this, getPackageName() + ".files", f);
                Intent cam = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
                cam.putExtra(MediaStore.EXTRA_OUTPUT, cameraUri);
                cam.setClipData(ClipData.newRawUri("", cameraUri));
                cam.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION | Intent.FLAG_GRANT_READ_URI_PERMISSION);
                chooser.putExtra(Intent.EXTRA_INITIAL_INTENTS, new Intent[] { cam });
            } catch (Exception e) {
                cameraUri = null;
            }
        }

        try {
            startActivityForResult(chooser, REQ_FILE);
            return true;
        } catch (ActivityNotFoundException e) {
            fileCallback = null;
            Toast.makeText(this, "Nessuna app disponibile per scegliere i file", Toast.LENGTH_LONG).show();
            return false;
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);

        if (requestCode == REQ_FILE) {
            Uri[] result = null;
            if (resultCode == RESULT_OK) {
                if (data != null && data.getData() != null) {
                    result = new Uri[] { data.getData() };
                } else if (data != null && data.getClipData() != null && data.getClipData().getItemCount() > 0) {
                    result = new Uri[] { data.getClipData().getItemAt(0).getUri() };
                } else if (cameraUri != null) {
                    result = new Uri[] { cameraUri };
                }
            }
            if (fileCallback != null) fileCallback.onReceiveValue(result);
            fileCallback = null;
            return;
        }

        if (requestCode == REQ_SAVE) {
            boolean ok = false;
            if (resultCode == RESULT_OK && data != null && data.getData() != null && pendingSave != null) {
                try (OutputStream out = getContentResolver().openOutputStream(data.getData())) {
                    if (out != null) {
                        out.write(pendingSave);
                        ok = true;
                    }
                } catch (Exception e) {
                    ok = false;
                }
            }
            pendingSave = null;
            notifySaved(ok, resultCode == RESULT_OK);
        }
    }

    private void notifySaved(boolean ok, boolean attempted) {
        String js = "window.__nativeSaved && window.__nativeSaved(" + ok + "," + attempted + ")";
        web.evaluateJavascript(js, null);
    }

    /* ------------------------- utilità ------------------------- */

    private void openExternal(Uri uri) {
        try {
            Intent i = new Intent(Intent.ACTION_VIEW, uri);
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(i);
        } catch (ActivityNotFoundException e) {
            Toast.makeText(this, "Nessun browser disponibile per aprire il collegamento", Toast.LENGTH_LONG).show();
        }
    }

    private static String safeName(String name) {
        String n = name == null ? "file" : name.replaceAll("[^A-Za-z0-9._-]", "_");
        return n.isEmpty() ? "file" : n;
    }

    /** Funzioni richiamabili dall'app (JavaScript: window.QuadratoAndroid). */
    private class Bridge {

        /** Salva un file scegliendo dove (Download, chiavetta, Drive...). */
        @JavascriptInterface
        public void saveFile(final String name, final String mime, final String base64) {
            final byte[] bytes;
            try {
                bytes = Base64.decode(base64, Base64.DEFAULT);
            } catch (IllegalArgumentException e) {
                runOnUiThread(() -> notifySaved(false, true));
                return;
            }
            runOnUiThread(() -> {
                pendingSave = bytes;
                Intent i = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                i.addCategory(Intent.CATEGORY_OPENABLE);
                i.setType(mime == null || mime.isEmpty() ? "application/octet-stream" : mime);
                i.putExtra(Intent.EXTRA_TITLE, safeName(name));
                try {
                    startActivityForResult(i, REQ_SAVE);
                } catch (ActivityNotFoundException e) {
                    pendingSave = null;
                    shareBytes(name, mime, bytes);
                }
            });
        }

        /** Condivide un file (Mail, WhatsApp, Bluetooth...). */
        @JavascriptInterface
        public void shareFile(final String name, final String mime, final String base64) {
            final byte[] bytes;
            try {
                bytes = Base64.decode(base64, Base64.DEFAULT);
            } catch (IllegalArgumentException e) {
                return;
            }
            runOnUiThread(() -> shareBytes(name, mime, bytes));
        }

        /** Apre un indirizzo nel browser (es. scaricare l'aggiornamento dell'app). */
        @JavascriptInterface
        public void openUrl(final String url) {
            runOnUiThread(() -> openExternal(Uri.parse(url)));
        }

        @JavascriptInterface
        public String appVersion() {
            try {
                return getPackageManager().getPackageInfo(getPackageName(), 0).versionName;
            } catch (Exception e) {
                return "";
            }
        }
    }

    private void shareBytes(String name, String mime, byte[] bytes) {
        try {
            File dir = new File(getCacheDir(), "condivisi");
            if (!dir.exists()) dir.mkdirs();
            File f = new File(dir, safeName(name));
            try (FileOutputStream out = new FileOutputStream(f)) {
                out.write(bytes);
            }
            Uri uri = FileProvider.getUriForFile(this, getPackageName() + ".files", f);
            Intent send = new Intent(Intent.ACTION_SEND);
            send.setType(mime == null || mime.isEmpty() ? "application/octet-stream" : mime);
            send.putExtra(Intent.EXTRA_STREAM, uri);
            send.putExtra(Intent.EXTRA_SUBJECT, safeName(name));
            send.setClipData(ClipData.newRawUri("", uri));
            send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            startActivity(Intent.createChooser(send, "Condividi"));
        } catch (Exception e) {
            Toast.makeText(this, "Condivisione non riuscita", Toast.LENGTH_LONG).show();
        }
    }

    /* ------------------------- ciclo di vita ------------------------- */

    @Override
    public void onBackPressed() {
        // Prima chiude finestre aperte o torna alla Cassa; dalla Cassa manda l'app in secondo piano.
        web.evaluateJavascript("(window.__onBack && window.__onBack()) ? 'si' : 'no'", value -> {
            if (value == null || !value.contains("si")) moveTaskToBack(true);
        });
    }

    @Override
    protected void onPause() {
        super.onPause();
        web.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.onResume();
    }

    @Override
    protected void onDestroy() {
        if (web != null) web.destroy();
        super.onDestroy();
    }
}
