import Capacitor
import UIKit

/// Capacitor's web view with the app's own LiveStatus plugin (decision 0361): a local plugin is registered here.
class RivrBridgeViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(LiveStatusPlugin())
    }
}
