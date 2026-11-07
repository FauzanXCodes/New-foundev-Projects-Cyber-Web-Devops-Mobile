import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/user_profile.dart';

class ProfileStorage {
  static const _profileKey = 'user_profile';
  static const _profileDoneKey = 'profile_completed';

  static Future<void> saveProfile(UserProfile profile) async {
    final prefs = await SharedPreferences.getInstance();
    final map = profile.toMap();
    await prefs.setString(_profileKey, jsonEncode(map));
    await prefs.setBool(_profileDoneKey, true);
  }

  static Future<UserProfile?> loadProfile() async {
    final prefs = await SharedPreferences.getInstance();
    final json = prefs.getString(_profileKey);
    if (json == null) return null;

    final map = jsonDecode(json) as Map<String, dynamic>;

    VehicleInfo? vehicle;
    final vehicleMap = map['vehicle'];
    if (vehicleMap != null) {
      vehicle = VehicleInfo(
        type: vehicleMap['type'] ?? '',
        model: vehicleMap['model'] ?? '',
        plateNo: vehicleMap['plateNo'] ?? '',
      );
    }

    return UserProfile(
      name: map['name'] ?? '',
      rollNumber: map['rollNumber'] ?? '',
      department: map['department'] ?? '',
      phone: map['phone'] ?? '',
      vehicle: vehicle,
    );
  }

  static Future<bool> isProfileCompleted() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool(_profileDoneKey) ?? false;
  }
}
