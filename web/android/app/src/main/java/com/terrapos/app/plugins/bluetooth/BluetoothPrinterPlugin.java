package com.terrapos.app.plugins.bluetooth;

import android.Manifest;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothSocket;
import android.content.pm.PackageManager;
import android.os.Build;
import android.util.Log;

import androidx.core.app.ActivityCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.IOException;
import java.io.OutputStream;
import java.util.Set;
import java.util.UUID;

@CapacitorPlugin(
    name = "BluetoothPrinter",
    permissions = {
        @Permission(strings = { Manifest.permission.BLUETOOTH }, alias = "bluetooth"),
        @Permission(strings = { Manifest.permission.BLUETOOTH_ADMIN }, alias = "bluetoothAdmin"),
        @Permission(strings = { Manifest.permission.BLUETOOTH_CONNECT }, alias = "bluetoothConnect"),
        @Permission(strings = { Manifest.permission.BLUETOOTH_SCAN }, alias = "bluetoothScan"),
        @Permission(strings = { Manifest.permission.ACCESS_FINE_LOCATION }, alias = "location")
    }
)
public class BluetoothPrinterPlugin extends Plugin {

    private static final String TAG = "BluetoothPrinter";
    private static final UUID SPP_UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");

    private BluetoothAdapter bluetoothAdapter;
    private BluetoothSocket socket;
    private OutputStream outputStream;
    private String connectedDeviceName = "";
    private String connectedDeviceAddress = "";

    @Override
    public void load() {
        bluetoothAdapter = BluetoothAdapter.getDefaultAdapter();
    }

    @PluginMethod
    public void isAvailable(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("available", bluetoothAdapter != null);
        ret.put("enabled", bluetoothAdapter != null && bluetoothAdapter.isEnabled());
        call.resolve(ret);
    }

    @PluginMethod
    public void listDevices(PluginCall call) {
        if (bluetoothAdapter == null) {
            call.reject("Bluetooth not available");
            return;
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            if (ActivityCompat.checkSelfPermission(getContext(), Manifest.permission.BLUETOOTH_CONNECT) != PackageManager.PERMISSION_GRANTED) {
                requestAllPermissions(call, "listDevicesCallback");
                return;
            }
        }

        doListDevices(call);
    }

    @PermissionCallback
    private void listDevicesCallback(PluginCall call) {
        doListDevices(call);
    }

    private void doListDevices(PluginCall call) {
        try {
            Set<BluetoothDevice> pairedDevices = bluetoothAdapter.getBondedDevices();
            JSArray devices = new JSArray();

            for (BluetoothDevice device : pairedDevices) {
                JSObject d = new JSObject();
                d.put("name", device.getName() != null ? device.getName() : "Unknown");
                d.put("address", device.getAddress());
                devices.put(d);
            }

            JSObject ret = new JSObject();
            ret.put("devices", devices);
            call.resolve(ret);
        } catch (SecurityException e) {
            call.reject("Bluetooth permission denied: " + e.getMessage());
        }
    }

    @PluginMethod
    public void connect(PluginCall call) {
        String address = call.getString("address");
        if (address == null || address.isEmpty()) {
            call.reject("Address is required");
            return;
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            if (ActivityCompat.checkSelfPermission(getContext(), Manifest.permission.BLUETOOTH_CONNECT) != PackageManager.PERMISSION_GRANTED) {
                requestAllPermissions(call, "connectCallback");
                return;
            }
        }

        doConnect(call, address);
    }

    @PermissionCallback
    private void connectCallback(PluginCall call) {
        String address = call.getString("address");
        if (address != null) {
            doConnect(call, address);
        }
    }

    private void doConnect(PluginCall call, String address) {
        try {
            // Disconnect existing
            disconnect(null);

            BluetoothDevice device = bluetoothAdapter.getRemoteDevice(address);
            socket = device.createRfcommSocketToServiceRecord(SPP_UUID);

            // Cancel discovery to speed up connection
            bluetoothAdapter.cancelDiscovery();

            socket.connect();
            outputStream = socket.getOutputStream();
            connectedDeviceName = device.getName() != null ? device.getName() : "Printer";
            connectedDeviceAddress = address;

            JSObject ret = new JSObject();
            ret.put("connected", true);
            ret.put("name", connectedDeviceName);
            ret.put("address", connectedDeviceAddress);
            call.resolve(ret);

            Log.i(TAG, "Connected to: " + connectedDeviceName);
        } catch (SecurityException e) {
            call.reject("Bluetooth permission denied: " + e.getMessage());
        } catch (IOException e) {
            call.reject("Connection failed: " + e.getMessage());
            try { if (socket != null) socket.close(); } catch (IOException ignored) {}
            socket = null;
            outputStream = null;
        }
    }

    @PluginMethod
    public void disconnect(PluginCall call) {
        try {
            if (outputStream != null) { outputStream.close(); outputStream = null; }
            if (socket != null) { socket.close(); socket = null; }
            connectedDeviceName = "";
            connectedDeviceAddress = "";

            if (call != null) {
                JSObject ret = new JSObject();
                ret.put("disconnected", true);
                call.resolve(ret);
            }
        } catch (IOException e) {
            if (call != null) call.reject("Disconnect error: " + e.getMessage());
        }
    }

    @PluginMethod
    public void isConnected(PluginCall call) {
        boolean connected = socket != null && socket.isConnected();
        JSObject ret = new JSObject();
        ret.put("connected", connected);
        ret.put("name", connectedDeviceName);
        ret.put("address", connectedDeviceAddress);
        call.resolve(ret);
    }

    @PluginMethod
    public void print(PluginCall call) {
        String text = call.getString("text");
        if (text == null || text.isEmpty()) {
            call.reject("Text is required");
            return;
        }

        if (outputStream == null || socket == null || !socket.isConnected()) {
            call.reject("Printer not connected");
            return;
        }

        try {
            byte[] data = text.getBytes("UTF-8");
            outputStream.write(data);
            outputStream.flush();

            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (IOException e) {
            call.reject("Print failed: " + e.getMessage());
            // Connection may be lost
            try { socket.close(); } catch (IOException ignored) {}
            socket = null;
            outputStream = null;
        }
    }

    @PluginMethod
    public void printRaw(PluginCall call) {
        JSArray rawBytes = call.getArray("bytes");
        if (rawBytes == null) {
            call.reject("Bytes array is required");
            return;
        }

        if (outputStream == null || socket == null || !socket.isConnected()) {
            call.reject("Printer not connected");
            return;
        }

        try {
            byte[] data = new byte[rawBytes.length()];
            for (int i = 0; i < rawBytes.length(); i++) {
                data[i] = (byte) rawBytes.getInt(i);
            }

            outputStream.write(data);
            outputStream.flush();

            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Print failed: " + e.getMessage());
        }
    }
}
