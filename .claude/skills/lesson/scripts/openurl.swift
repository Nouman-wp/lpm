// openurl <pid> <url>: hands <url> to the app with that pid the way Launch
// Services does when a link is opened, as a kAEGetURL Apple Event. A lesson app
// runs from its debug binary, with no bundle to register a URL scheme, so this
// is how a take gives it a link through the path an installed lpm takes.
import CoreServices
import Foundation

let args = CommandLine.arguments
guard args.count == 3, let pid = Int32(args[1]) else {
    FileHandle.standardError.write("usage: openurl <pid> <url>\n".data(using: .utf8)!)
    exit(2)
}
// 'GURL', both the class and the id (kInternetEventClass, kAEGetURL).
let gurl: FourCharCode = 0x4755_524C
let event = NSAppleEventDescriptor(
    eventClass: gurl,
    eventID: gurl,
    targetDescriptor: NSAppleEventDescriptor(processIdentifier: pid),
    returnID: AEReturnID(kAutoGenerateReturnID),
    transactionID: AETransactionID(kAnyTransactionID)
)
event.setParam(NSAppleEventDescriptor(string: args[2]), forKeyword: AEKeyword(keyDirectObject))
let status = AESendMessage(event.aeDesc!, nil, AESendMode(kAENoReply), 300)
if status != noErr {
    FileHandle.standardError.write("openurl: AESendMessage failed (\(status))\n".data(using: .utf8)!)
    exit(1)
}
