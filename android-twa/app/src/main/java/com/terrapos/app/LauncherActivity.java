package com.terrapos.app;

import android.net.Uri;
import android.os.Bundle;
import androidx.browser.customtabs.CustomTabsIntent;
import androidx.browser.trusted.TrustedWebActivityIntentBuilder;
import androidx.appcompat.app.AppCompatActivity;

public class LauncherActivity extends AppCompatActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        Uri url = Uri.parse("https://npos.gtomodachi.fun/pos");

        TrustedWebActivityIntentBuilder builder = new TrustedWebActivityIntentBuilder(url);
        
        CustomTabsIntent customTabsIntent = builder.buildCustomTabsIntent();
        customTabsIntent.launchUrl(this, url);
        
        finish();
    }
}
