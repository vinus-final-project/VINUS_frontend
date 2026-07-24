package com.vinus.kiosk;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;

import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;

/**
 * MainActivity — 결제 앱 스킴(intent:// 등) 처리 커스텀.
 *
 * 토스 결제창이 카드사/간편결제 앱을 intent:// 스킴으로 호출하는데,
 * WebView 는 이 스킴을 몰라 ERR_UNKNOWN_URL_SCHEME 으로 죽는다.
 * (예: 카카오페이 → intent://kakaopay/pg?...)
 *
 * 처리 규칙 (토스페이먼츠 안드로이드 웹뷰 연동 가이드 패턴):
 *   - http/https        → 기본 동작 (WebView 내 탐색 — allowNavigation)
 *   - intent://         → 파싱 후 해당 앱 실행.
 *                          미설치면 browser_fallback_url → 없으면 마켓 이동
 *   - 기타 커스텀 스킴   → ACTION_VIEW 로 앱 실행 시도 (ispmobile:// 등)
 *
 * 결제 앱에서 인증이 끝나면 앱이 다시 전면으로 돌아오고, 결제창이
 * successUrl(https://localhost/pay?...) 로 리다이렉트해 결제가 이어진다.
 */
public class MainActivity extends BridgeActivity {

    /**
     * 커스텀 Capacitor 플러그인 등록.
     *   ▸ MediaVolume — TTS duck 을 위한 STREAM_MUSIC 볼륨 조절 (AudioManager)
     * super.onCreate() 이전에 registerPlugin 필요.
     */
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(MediaVolumePlugin.class);
        super.onCreate(savedInstanceState);
    }

    @Override
    public void onStart() {
        super.onStart();
        Bridge bridge = this.getBridge();
        bridge.setWebViewClient(new BridgeWebViewClient(bridge) {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();
                if (handlePaymentScheme(view, url)) {
                    return true; // WebView 로 로드하지 않음 (스킴 에러 방지)
                }
                return super.shouldOverrideUrlLoading(view, request);
            }
        });
    }

    /** 결제 앱 스킴 처리 — 처리했으면 true, WebView 기본 동작이면 false */
    private boolean handlePaymentScheme(WebView view, String url) {
        if (url == null) return false;

        // 일반 웹 탐색은 기본 동작 (Capacitor allowNavigation 정책)
        if (url.startsWith("http://") || url.startsWith("https://")
                || url.startsWith("about:") || url.startsWith("javascript:")) {
            return false;
        }

        // intent:// — 카드사/간편결제 앱 호출 (카카오페이, 앱카드 등)
        if (url.startsWith("intent://")) {
            try {
                Intent intent = Intent.parseUri(url, Intent.URI_INTENT_SCHEME);
                try {
                    startActivity(intent);
                } catch (ActivityNotFoundException e) {
                    // 앱 미설치 — 결제사가 지정한 fallback 페이지 → 없으면 마켓
                    String fallback = intent.getStringExtra("browser_fallback_url");
                    if (fallback != null) {
                        view.loadUrl(fallback);
                    } else if (intent.getPackage() != null) {
                        startActivity(new Intent(
                                Intent.ACTION_VIEW,
                                Uri.parse("market://details?id=" + intent.getPackage())
                        ));
                    }
                }
            } catch (Exception ignored) {
                // 파싱 실패 등 — 조용히 무시 (결제창에서 다른 수단 선택 가능)
            }
            return true;
        }

        // 그 외 커스텀 스킴 (ispmobile://, kakaotalk:// 등) — 앱 실행 시도
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
        } catch (Exception ignored) {
            // 미설치/미지원 — 무시
        }
        return true;
    }
}
