import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';

class AuthStorage {
  static const _usersKey = 'users_list';      // list of users in JSON
  static const _currentUserKey = 'current_user'; // currently logged-in username

  /// Register a new user. Returns true if success, false if username exists.
  static Future<bool> registerUser(String username, String password) async {
    final prefs = await SharedPreferences.getInstance();
    final usersJson = prefs.getString(_usersKey);
    List<Map<String, dynamic>> users = [];

    if (usersJson != null) {
      final decoded = jsonDecode(usersJson) as List;
      users = decoded.cast<Map<String, dynamic>>();
    }

    // Check if username already exists
    final exists = users.any((u) => u['username'] == username);
    if (exists) return false;

    users.add({'username': username, 'password': password});

    await prefs.setString(_usersKey, jsonEncode(users));
    return true;
  }

  /// Validate login. Returns true if username/password match.
  static Future<bool> loginUser(String username, String password) async {
    final prefs = await SharedPreferences.getInstance();
    final usersJson = prefs.getString(_usersKey);

    if (usersJson == null) return false;

    final decoded = jsonDecode(usersJson) as List;
    final users = decoded.cast<Map<String, dynamic>>();

    final match = users.any(
      (u) => u['username'] == username && u['password'] == password,
    );

    if (match) {
      await prefs.setString(_currentUserKey, username);
    }

    return match;
  }

  static Future<String?> getCurrentUser() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_currentUserKey);
  }

  static Future<void> logout() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_currentUserKey);
  }
}
