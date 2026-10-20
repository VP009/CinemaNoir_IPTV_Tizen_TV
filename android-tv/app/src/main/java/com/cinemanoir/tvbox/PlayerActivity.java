package com.cinemanoir.tvbox;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.os.Bundle;
import android.view.KeyEvent;
import android.view.View;
import android.view.WindowInsets;
import android.widget.FrameLayout;
import android.widget.Toast;

import androidx.media3.common.MediaItem;
import androidx.media3.common.C;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.Player;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.ui.PlayerView;

/** Full-screen, remote-friendly Media3 player for Android TV and generic TV Boxes. */
public final class PlayerActivity extends Activity {
    static final String EXTRA_URL = "url";
    static final String EXTRA_TITLE = "title";
    static final String EXTRA_POSITION_MS = "positionMs";
    static final String EXTRA_LIVE = "live";
    static final String RESULT_POSITION_MS = "positionMs";
    static final String RESULT_DURATION_MS = "durationMs";
    static final String RESULT_COMPLETED = "completed";
    static final String RESULT_ERROR = "error";

    private ExoPlayer player;
    private PlayerView playerView;
    private boolean isLive;
    private boolean completed;
    private String playbackError = "";
    private static final long SEEK_BACK_MS = 10_000L;
    private static final long SEEK_FORWARD_MS = 30_000L;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        enterImmersiveMode();
        getWindow().setStatusBarColor(Color.BLACK);
        getWindow().setNavigationBarColor(Color.BLACK);

        playerView = new PlayerView(this);
        playerView.setUseController(true);
        playerView.setControllerAutoShow(true);
        playerView.setControllerShowTimeoutMs(5000);
        playerView.setControllerAnimationEnabled(false);
        playerView.setShowRewindButton(true);
        playerView.setShowFastForwardButton(true);
        playerView.setShowPreviousButton(false);
        playerView.setShowNextButton(false);
        playerView.setShowSubtitleButton(true);
        playerView.setShowVrButton(false);
        playerView.setShowBuffering(PlayerView.SHOW_BUFFERING_ALWAYS);
        playerView.setKeepScreenOn(true);
        playerView.setFocusable(true);
        playerView.setFocusableInTouchMode(true);
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.BLACK);
        root.addView(playerView, new FrameLayout.LayoutParams(-1, -1));
        setContentView(root);

        String url = getIntent().getStringExtra(EXTRA_URL);
        if (url == null || url.trim().isEmpty()) { finishWithResult(); return; }
        isLive = getIntent().getBooleanExtra(EXTRA_LIVE, false);
        player = new ExoPlayer.Builder(this)
                .setSeekBackIncrementMs(SEEK_BACK_MS)
                .setSeekForwardIncrementMs(SEEK_FORWARD_MS)
                .build();
        playerView.setPlayer(player);
        player.addListener(new Player.Listener() {
            @Override public void onPlaybackStateChanged(int state) {
                if (state == Player.STATE_ENDED) {
                    completed = true;
                    finishWithResult();
                }
            }
            @Override public void onPlayerError(PlaybackException error) {
                playbackError = "Não foi possível reproduzir esta transmissão.";
                Toast.makeText(PlayerActivity.this, playbackError, Toast.LENGTH_LONG).show();
            }
        });
        player.setMediaItem(MediaItem.fromUri(url));
        long position = Math.max(0L, getIntent().getLongExtra(EXTRA_POSITION_MS, 0L));
        player.prepare();
        if (!isLive && position > 0) player.seekTo(position);
        player.play();
        playerView.requestFocus();
    }

    @Override public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) enterImmersiveMode();
    }

    @Override protected void onStop() {
        super.onStop();
        if (player != null) player.pause();
    }

    @Override protected void onDestroy() {
        if (player != null) { player.release(); player = null; }
        super.onDestroy();
    }

    @Override public void onBackPressed() { finishWithResult(); }

    @Override public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (player == null) return super.onKeyDown(keyCode, event);

        switch (keyCode) {
            case KeyEvent.KEYCODE_DPAD_CENTER:
            case KeyEvent.KEYCODE_ENTER:
            case KeyEvent.KEYCODE_SPACE:
            case KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE:
            case KeyEvent.KEYCODE_HEADSETHOOK:
                if (player.isPlaying()) player.pause(); else player.play();
                playerView.showController();
                return true;

            case KeyEvent.KEYCODE_DPAD_LEFT:
                seekBy(-SEEK_BACK_MS);
                return true;

            case KeyEvent.KEYCODE_DPAD_RIGHT:
                seekBy(SEEK_FORWARD_MS);
                return true;

            case KeyEvent.KEYCODE_DPAD_UP:
            case KeyEvent.KEYCODE_DPAD_DOWN:
            case KeyEvent.KEYCODE_MENU:
            case KeyEvent.KEYCODE_INFO:
                playerView.showController();
                return true;

            default:
                return super.onKeyDown(keyCode, event);
        }
    }

    private void seekBy(long amountMs) {
        if (!isLive && player.isCommandAvailable(Player.COMMAND_SEEK_IN_CURRENT_MEDIA_ITEM)) {
            player.seekTo(Math.max(0L, player.getCurrentPosition() + amountMs));
        }
        playerView.showController();
    }

    private void finishWithResult() {
        long position = player == null ? 0 : Math.max(0L, player.getCurrentPosition());
        long rawDuration = player == null ? C.TIME_UNSET : player.getDuration();
        long duration = rawDuration == C.TIME_UNSET ? 0 : Math.max(0L, rawDuration);
        Intent result = new Intent();
        result.putExtra(RESULT_POSITION_MS, position);
        result.putExtra(RESULT_DURATION_MS, duration);
        result.putExtra(RESULT_COMPLETED, completed);
        result.putExtra(RESULT_ERROR, playbackError);
        setResult(RESULT_OK, result);
        finish();
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
}
