// FlightActivityAttributes.swift — APP-TARGET copy.
//
// EXACT MIRROR of targets/flight-activity/FlightActivityAttributes.swift.
//
// The ActivityKit attributes type must be compiled into BOTH the widget
// extension (targets/flight-activity/, via @bacons/apple-targets) AND the app
// target — here, this Expo module's pod (source_files globs **/*.swift). Without
// this copy, FlightLiveActivityModule cannot see FlightActivityAttributes /
// FlightActivityState / FlightStatus and the Xcode build fails with
// "cannot find type 'FlightActivityAttributes' in scope".
//
// The two files live in separate binaries (app vs. widget extension), so there
// is no duplicate-symbol clash. ActivityKit matches an Activity across app and
// widget by the attributes type's Codable structure, so keep these two files
// byte-for-byte identical — any drift silently breaks Live Activity hand-off.
import ActivityKit
import Foundation

public enum FlightStatus: String, Codable, CaseIterable {
    case scheduled, onTime, boarding, finalCall, delayed, departed, cancelled

    public var label: String {
        switch self {
        case .scheduled: return "Scheduled"
        case .onTime: return "On Time"
        case .boarding: return "Boarding"
        case .finalCall: return "Final Call"
        case .delayed: return "Delayed"
        case .departed: return "Departed"
        case .cancelled: return "Cancelled"
        }
    }

    public var isUrgent: Bool { self == .finalCall || self == .delayed || self == .cancelled }
}

public struct FlightActivityAttributes: ActivityAttributes {
    public typealias ContentState = FlightActivityState

    // Static — set once at creation.
    public let flightNumber: String
    public let airlineName: String
    public let originIATA: String
    public let destinationIATA: String
    public let scheduledDeparture: Date

    public init(flightNumber: String, airlineName: String, originIATA: String,
                destinationIATA: String, scheduledDeparture: Date) {
        self.flightNumber = flightNumber
        self.airlineName = airlineName
        self.originIATA = originIATA
        self.destinationIATA = destinationIATA
        self.scheduledDeparture = scheduledDeparture
    }
}

public struct FlightActivityState: Codable, Hashable {
    public var gate: String?
    public var terminal: String?
    public var status: FlightStatus
    public var estimatedDeparture: Date
    public var delayMinutes: Int?

    public init(gate: String? = nil, terminal: String? = nil, status: FlightStatus,
                estimatedDeparture: Date, delayMinutes: Int? = nil) {
        self.gate = gate
        self.terminal = terminal
        self.status = status
        self.estimatedDeparture = estimatedDeparture
        self.delayMinutes = delayMinutes
    }
}
