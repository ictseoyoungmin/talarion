package dev.talarion.signalgarden;

import android.app.Activity;
import android.content.res.Configuration;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.util.Log;
import android.view.View;
import android.webkit.ConsoleMessage;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;

public final class GameActivity extends Activity {
    private static final String ORIGIN = "appassets.androidplatform.net";
    private static final String URL = "https://" + ORIGIN + "/index.html";
    private static final String TAG = "TalarionGame";
    private WebView game;

    private static WebResourceResponse blocked(int code) {
        return new WebResourceResponse("text/plain", "UTF-8", code, "Blocked",
                Collections.singletonMap("Cache-Control", "no-store"),
                new ByteArrayInputStream(new byte[0]));
    }

    private static String contentType(String name) {
        if (name.endsWith(".html")) return "text/html";
        if (name.endsWith(".mjs") || name.endsWith(".js")) return "text/javascript";
        if (name.endsWith(".json")) return "application/json";
        if (name.endsWith(".css")) return "text/css";
        if (name.endsWith(".png")) return "image/png";
        if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
        if (name.endsWith(".webp")) return "image/webp";
        if (name.endsWith(".glb")) return "model/gltf-binary";
        return null;
    }

    private static boolean permitted(Uri url) {
        return "https".equals(url.getScheme())
                && ORIGIN.equals(url.getHost())
                && (url.getPort() == -1 || url.getPort() == 443)
                && url.getUserInfo() == null;
    }

    @Override public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
        game = new WebView(this);
        game.setBackgroundColor(Color.rgb(12, 21, 32));
        setContentView(game);
        WebSettings settings = game.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(false);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setSupportMultipleWindows(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setMediaPlaybackRequiresUserGesture(true);
        game.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onConsoleMessage(ConsoleMessage line) {
                String message = line.message();
                if (message.startsWith("TALARION_")) {
                    Log.i(TAG, message);
                } else if (line.messageLevel() == ConsoleMessage.MessageLevel.ERROR) {
                    Log.e(TAG, "JS_ERROR " + message);
                }
                return true;
            }
        });
        game.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return !permitted(request.getUrl());
            }
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri url = request.getUrl();
                if (!permitted(url)) return blocked(403);
                String encoded = url.getEncodedPath();
                if (encoded == null || encoded.isEmpty()) encoded = "/";
                if (encoded.equals("/")) encoded = "/index.html";
                // Reject encoded traversal, backslashes, double slash, and unknown paths.
                if (!encoded.matches("/[A-Za-z0-9_./-]+") || encoded.contains("..") ||
                    encoded.contains("//") || encoded.contains("%")) return blocked(403);
                String name = encoded.substring(1);
                String type = contentType(name);
                if (type == null) return blocked(404);
                try {
                    InputStream stream = getAssets().open("game/" + name);
                    Map<String,String> headers = new HashMap<>();
                    headers.put("Cache-Control", "no-store");
                    headers.put("X-Content-Type-Options", "nosniff");
                    headers.put("Access-Control-Allow-Origin", "https://" + ORIGIN);
                    return new WebResourceResponse(type, "UTF-8", 200, "OK", headers, stream);
                } catch (IOException error) {
                    Log.e(TAG, "ASSET_NOT_FOUND " + name);
                    return blocked(404);
                }
            }
        });
        boolean replay = getIntent().getBooleanExtra("talarion_replay", false);
        Log.i(TAG, "TALARION_HOST " + (replay ? "REPLAY" : "INTERACTIVE"));
        game.loadUrl(URL + (replay ? "?talarionReplay=1" : ""));
    }
    @Override protected void onPause() {
        super.onPause();
        if (game != null) game.onPause();
    }
    @Override protected void onResume() {
        super.onResume();
        if (game != null) game.onResume();
    }
    @Override public void onConfigurationChanged(Configuration config) {
        super.onConfigurationChanged(config);
    }
    @Override protected void onDestroy() {
        if (game != null) { game.destroy(); game = null; }
        super.onDestroy();
    }
}
