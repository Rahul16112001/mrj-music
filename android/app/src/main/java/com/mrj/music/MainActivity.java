package com.mrj.music;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.mrj.music.bridge.MRJNativePlayerPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(MRJNativePlayerPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
