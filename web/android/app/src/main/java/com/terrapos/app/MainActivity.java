package com.terrapos.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.terrapos.app.plugins.bluetooth.BluetoothPrinterPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(BluetoothPrinterPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
