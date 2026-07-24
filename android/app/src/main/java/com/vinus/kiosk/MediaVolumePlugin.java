package com.vinus.kiosk;

import android.content.Context;
import android.media.AudioManager;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * MediaVolume — TTS duck 을 위한 시스템 미디어 볼륨 조절 플러그인.
 *
 * duck()   : 현재 STREAM_MUSIC 볼륨을 저장하고 75% 로 감소
 * unduck() : 저장된 원본 볼륨으로 복원
 *
 * 사용 흐름 (frontend):
 *   TtsPlayer 재생 중 사용자 발화가 감지되면 useMicStream 이 duck 을 호출.
 *   hangover 만료(발화 종료) 시 unduck 로 복원.
 *   PageGuide/receipt/end/receiptModal 안내는 duck 대상 아님 (콜백 미등록).
 *
 * 주의:
 *   - STREAM_MUSIC 은 시스템 미디어 볼륨. 다른 앱 소리도 함께 낮아진다.
 *   - savedVolume=-1 초기값. duck 중복 호출은 원본 유지 (idempotent).
 *   - 크래시 대비: unduck 은 savedVolume>=0 일 때만 복원 수행.
 */
@CapacitorPlugin(name = "MediaVolume")
public class MediaVolumePlugin extends Plugin {

    private int savedVolume = -1;

    @PluginMethod
    public void duck(PluginCall call) {
        try {
            AudioManager am = (AudioManager) getContext()
                    .getSystemService(Context.AUDIO_SERVICE);
            if (am == null) {
                call.reject("AudioManager 접근 실패");
                return;
            }
            int cur = am.getStreamVolume(AudioManager.STREAM_MUSIC);
            if (savedVolume < 0) {
                savedVolume = cur;
            }
            int reduced = Math.max(0, savedVolume * 3 / 4);
            am.setStreamVolume(AudioManager.STREAM_MUSIC, reduced, 0);
            call.resolve();
        } catch (Exception e) {
            call.reject("duck 실패: " + e.getMessage());
        }
    }

    @PluginMethod
    public void unduck(PluginCall call) {
        try {
            AudioManager am = (AudioManager) getContext()
                    .getSystemService(Context.AUDIO_SERVICE);
            if (am == null) {
                call.reject("AudioManager 접근 실패");
                return;
            }
            if (savedVolume >= 0) {
                am.setStreamVolume(AudioManager.STREAM_MUSIC, savedVolume, 0);
                savedVolume = -1;
            }
            call.resolve();
        } catch (Exception e) {
            call.reject("unduck 실패: " + e.getMessage());
        }
    }
}
