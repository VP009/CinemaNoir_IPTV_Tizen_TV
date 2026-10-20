package com.cinemanoir.tvbox;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.view.WindowInsets;
import android.webkit.ConsoleMessage;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import org.json.JSONException;
import org.json.JSONObject;

/** Hosts the existing TV interface and delegates playback to Media3. */
public final class MainActivity extends Activity {
    private static final int PLAYER_REQUEST = 4201;
    private WebView webView;

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        enterImmersiveMode();
        getWindow().setStatusBarColor(Color.BLACK);
        getWindow().setNavigationBarColor(Color.BLACK);

        webView = new WebView(this);
        webView.setLayerType(View.LAYER_TYPE_HARDWARE, null);
        webView.setBackgroundColor(Color.rgb(7, 6, 11));
        webView.getSettings().setJavaScriptEnabled(true);
        webView.getSettings().setDomStorageEnabled(true);
        // Respect the device viewport. A fixed logical width causes the WebView
        // to render content outside the visible area on many TV Boxes.
        webView.getSettings().setUseWideViewPort(false);
        webView.getSettings().setLoadWithOverviewMode(false);
        webView.setInitialScale(0);
        if (android.os.Build.VERSION.SDK_INT >= 23) webView.getSettings().setOffscreenPreRaster(true);
        if (android.os.Build.VERSION.SDK_INT >= 26) webView.setRendererPriorityPolicy(WebView.RENDERER_PRIORITY_IMPORTANT, true);
        webView.getSettings().setMediaPlaybackRequiresUserGesture(false);
        webView.getSettings().setMixedContentMode(android.webkit.WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        webView.setWebViewClient(new LocalOnlyWebViewClient());
        webView.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onConsoleMessage(ConsoleMessage message) {
                android.util.Log.d("CinemaNoir", message.message());
                return true;
            }
        });
        webView.addJavascriptInterface(new AndroidPlayerBridge(), "AndroidPlayer");
        setContentView(webView);
        webView.loadUrl("file:///android_asset/app/index.html");
    }

    @Override public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) enterImmersiveMode();
    }

    @Override public void onBackPressed() {
        // Android TV sends KEYCODE_BACK to the Activity. Do not finish or reload
        // the WebView: let the app close modals/player and restore its own route.
        if (webView != null) {
            webView.evaluateJavascript(
                    "window.Noir&&typeof window.Noir.back==='function'&&window.Noir.back();", null);
        }
    }

    private void enterImmersiveMode() {
        if (android.os.Build.VERSION.SDK_INT >= 30) {
            getWindow().setDecorFitsSystemWindows(false);
            getWindow().getInsetsController().hide(WindowInsets.Type.statusBars() | WindowInsets.Type.navigationBars());
        } else {
            getWindow().getDecorView().setSystemUiVisibility(
                    View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY | View.SYSTEM_UI_FLAG_FULLSCREEN |
                    View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN |
                    View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
        }
    }

    private final class AndroidPlayerBridge {
        @JavascriptInterface public boolean isAvailable() { return true; }

        @JavascriptInterface public void play(final String json) {
            runOnUiThread(() -> {
                try {
                    JSONObject payload = new JSONObject(json);
                    String url = payload.optString("url", "");
                    Uri parsed = Uri.parse(url);
                    if (!("http".equalsIgnoreCase(parsed.getScheme()) || "https".equalsIgnoreCase(parsed.getScheme()))) {
                        notifyPlaybackError("URL de reprodução inválida.");
                        return;
                    }
                    Intent intent = new Intent(MainActivity.this, PlayerActivity.class);
                    intent.putExtra(PlayerActivity.EXTRA_URL, url);
                    intent.putExtra(PlayerActivity.EXTRA_TITLE, payload.optString("title", "Cinema Noir"));
                    intent.putExtra(PlayerActivity.EXTRA_POSITION_MS, Math.max(0L, payload.optLong("positionMs", 0L)));
                    intent.putExtra(PlayerActivity.EXTRA_LIVE, payload.optBoolean("live", false));
                    startActivityForResult(intent, PLAYER_REQUEST);
                } catch (JSONException error) {
                    notifyPlaybackError("Não foi possível iniciar o player Android.");
                }
            });
        }
    }

    @Override protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != PLAYER_REQUEST) return;
        JSONObject result = new JSONObject();
        try {
            result.put("positionMs", data == null ? 0 : data.getLongExtra(PlayerActivity.RESULT_POSITION_MS, 0));
            result.put("durationMs", data == null ? 0 : data.getLongExtra(PlayerActivity.RESULT_DURATION_MS, 0));
            result.put("completed", data != null && data.getBooleanExtra(PlayerActivity.RESULT_COMPLETED, false));
            result.put("error", data == null ? "" : data.getStringExtra(PlayerActivity.RESULT_ERROR));
        } catch (JSONException ignored) { }
        webView.evaluateJavascript("window.Noir&&window.Noir.onAndroidPlaybackResult&&window.Noir.onAndroidPlaybackResult(" + result + ");", null);
    }

    private void notifyPlaybackError(String message) {
        JSONObject result = new JSONObject();
        try { result.put("error", message); } catch (JSONException ignored) { }
        webView.evaluateJavascript("window.Noir&&window.Noir.onAndroidPlaybackResult&&window.Noir.onAndroidPlaybackResult(" + result + ");", null);
    }

    private static final class LocalOnlyWebViewClient extends WebViewClient {
        @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            return !"file".equalsIgnoreCase(request.getUrl().getScheme());
        }
    }
}
