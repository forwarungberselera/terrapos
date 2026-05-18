package com.terrapos.app;

import android.app.Activity;
import android.net.Uri;
import android.os.Bundle;
import androidx.browser.customtabs.CustomTabsIntent;

public class LauncherActivity extends Activity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        Uri url = Uri.parse("https://npos.gtomodachi.fun/pos");

        CustomTabsIntent intent = new CustomTabsIntent.Builder()
            .setShowTitle(false)
            .build();

        intent.launchUrl(this, url);
        finish();
    }
}
