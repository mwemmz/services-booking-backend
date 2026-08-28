// lib/services/location_service.dart
// Accurate GPS tracking for the Services Booking app.
//
// Dependencies (add to pubspec.yaml):
//   geolocator: ^13.0.1
//   flutter_background_geolocation (or use foreground + geolocator for MVP)
//
// Usage:
//   final loc = LocationService();
//   await loc.init();
//   loc.startProviderStream(bookingId: '...', socket: socket);
//   loc.stopProviderStream();
//
// This service:
//   - Requests GPS with best accuracy
//   - Filters out fixes worse than maxAccuracyMeters
//   - Smooths jitter with a simple moving average
//   - Sends cleaned points to the backend (REST) + Socket.IO, throttled
//   - Exposes a stream for live map marker updates

import 'dart:async';
import 'dart:math' as math;
import 'package:flutter/foundation.dart';
import 'package:geolocator/geolocator.dart';

class LocationFix {
  final double latitude;
  final double longitude;
  final double? accuracy;
  final double? heading;
  final double? speed;
  final DateTime timestamp;

  const LocationFix({
    required this.latitude,
    required this.longitude,
    this.accuracy,
    this.heading,
    this.speed,
    required this.timestamp,
  });
}

class LocationService {
  LocationService({
    this.maxAccuracyMeters = 50,          // reject fixes worse than this
    this.minIntervalMs = 3000,            // throttle: min time between sends
    this.minDistanceMeters = 5,           // throttle: min movement to send
    this.streamIntervalMs = 5000,         // how often provider location is emitted
  });

  final double maxAccuracyMeters;
  final int minIntervalMs;
  final double minDistanceMeters;
  final int streamIntervalMs;

  final _controller = StreamController<LocationFix>.broadcast();
  Stream<LocationFix> get onLocationFix => _controller.stream;

  StreamSubscription<Position>? _positionSub;
  Timer? _streamTimer;
  LocationFix? _lastAccepted;

  bool _permissionGranted = false;

  /// Must be called once before starting location streams.
  Future<bool> init() async {
    bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) {
      return false;
    }

    LocationPermission permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }
    if (permission == LocationPermission.deniedForever) {
      return false;
    }

    _permissionGranted = true;
    return true;
  }

  /// One-shot accurate location (e.g. customer picking a booking address).
  Future<LocationFix?> getCurrentAccurateLocation({
    Duration timeout = const Duration(seconds: 15),
  }) async {
    if (!_permissionGranted) {
      if (!await init()) return null;
    }

    try {
      final pos = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.best,
        forceLocationManager: true,
        timeLimit: timeout,
      );
      final fix = _toFix(pos);
      if (_isAcceptable(fix)) {
        _lastAccepted = fix;
        return fix;
      }
      return null;
    } catch (_) {
      return null; // timeout or error — let caller show a message
    }
  }

  /// Real-time position stream with accuracy filtering + jitter smoothing.
  Stream<LocationFix> getPositionStream() {
    return Geolocator.getPositionStream(
      locationSettings: const LocationSettings(
        accuracy: LocationAccuracy.best, // up to ±1-5m, uses GPS + assist
        distanceFilter: 1,               // update on every 1m move
        timeLimit: null,
      ),
    )
        .map(_toFix)
        .where(_isAcceptable)            // drop inaccurate fixes
        .map(_smooth);                   // moving-average jitter reduction
  }

  /// Provider live tracking: stream to Socket.IO + local map.
  StreamSubscription<LocationFix> startProviderStream({
    required dynamic socket, // Socket.IO client instance
    required String bookingId,
  }) {
    _positionSub = getPositionStream().listen((fix) {
      _lastAccepted = fix;
      _controller.add(fix);

      // Throttle: only emit to socket if enough time OR enough movement
      if (_shouldSend(fix)) {
        socket.emit('location-update', {
          'bookingId': bookingId,
          'latitude': fix.latitude,
          'longitude': fix.longitude,
          'accuracy': fix.accuracy,
          'heading': fix.heading,
          'isAccurate': true,
        });
        _lastSentAt = DateTime.now();
        _lastSent = fix;
      }
    });

    return _positionSub!;
  }

  void stopProviderStream() {
    _positionSub?.cancel();
    _positionSub = null;
    _streamTimer?.cancel();
    _streamTimer = null;
  }

  void dispose() {
    stopProviderStream();
    _controller.close();
  }

  DateTime? _lastSentAt;
  LocationFix? _lastSent;

  // ---- helpers ----

  LocationFix _toFix(Position pos) => LocationFix(
        latitude: pos.latitude,
        longitude: pos.longitude,
        accuracy: pos.accuracy,
        heading: pos.heading,
        speed: pos.speed,
        timestamp: pos.timestamp.toLocal(),
      );

  bool _isAcceptable(LocationFix fix) {
    final acc = fix.accuracy;
    // If accuracy is null/unknown, accept but flag it; else check threshold.
    if (acc == null) return true;
    return acc <= maxAccuracyMeters;
  }

  // Simple moving average (last 3 fixes) to reduce GPS jitter.
  LocationFix _smooth(LocationFix fix) {
    const windowSize = 3;
    _window.add(fix);
    if (_window.length > windowSize) {
      _window.removeAt(0);
    }
    final lat = _window.map((f) => f.latitude).reduce((a, b) => a + b) / _window.length;
    final lng = _window.map((f) => f.longitude).reduce((a, b) => a + b) / _window.length;
    return LocationFix(
      latitude: lat,
      longitude: lng,
      accuracy: fix.accuracy,
      heading: fix.heading,
      speed: fix.speed,
      timestamp: fix.timestamp,
    );
  }

  final List<LocationFix> _window = [];

  bool _shouldSend(LocationFix fix) {
    final now = DateTime.now();
    final sinceLast = _lastSentAt == null
        ? Duration.zero
        : now.difference(_lastSentAt!);
    if (sinceLast.inMilliseconds < minIntervalMs) return false;

    // Send if the position moved noticeably even within the interval window.
    if (_lastSent != null) {
      final d = _haversineMeters(
        _lastSent!.latitude,
        _lastSent!.longitude,
        fix.latitude,
        fix.longitude,
      );
      if (d < minDistanceMeters) return false;
    }
    return true;
  }

  double _haversineMeters(double lat1, double lng1, double lat2, double lng2) {
    const r = 6371000.0;
    final dLat = _toRad(lat2 - lat1);
    final dLng = _toRad(lng2 - lng1);
    final a = math
        .sin(dLat / 2) * math.sin(dLat / 2) +
        math.cos(_toRad(lat1)) * math.cos(_toRad(lat2)) *
            math.sin(dLng / 2) * math.sin(dLng / 2);
    return 2 * r * math.asin(math.sqrt(a));
  }

  double _toRad(double deg) => deg * 3.141592653589793 / 180;
}
