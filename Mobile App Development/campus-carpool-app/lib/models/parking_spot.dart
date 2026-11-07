class ParkingSpot {
  final String name;      // e.g. "College Parking"
  final String area;      // e.g. "Corporation Street"
  final String note;      // e.g. "Near basketball court"
  final double latitude;
  final double longitude;
  bool isFavourite;

  ParkingSpot({
    required this.name,
    required this.area,
    required this.note,
    required this.latitude,
    required this.longitude,
    this.isFavourite = false,
  });
}
