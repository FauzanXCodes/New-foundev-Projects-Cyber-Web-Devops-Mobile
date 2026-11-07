class VehicleInfo {
  final String type;
  final String model;
  final String plateNo;

  VehicleInfo({
    required this.type,
    required this.model,
    required this.plateNo,
  });

  Map<String, dynamic> toMap() {
    return {
      'type': type,
      'model': model,
      'plateNo': plateNo,
    };
  }
}

class UserProfile {
  final String name;
  final String rollNumber;
  final String department;
  final String phone;
  final VehicleInfo? vehicle;

  UserProfile({
    required this.name,
    required this.rollNumber,
    required this.department,
    required this.phone,
    this.vehicle,
  });

  Map<String, dynamic> toMap() {
    return {
      'name': name,
      'rollNumber': rollNumber,
      'department': department,
      'phone': phone,
      'vehicle': vehicle?.toMap(),
    };
  }
}
