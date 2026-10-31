package site.voicecoaching.speakai;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(PermissionSettingsPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
