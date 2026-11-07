import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';

/// A simple map where user taps to choose a parking location.
/// Returns LatLng when user presses "Confirm location".
class ParkingMapPickerScreen extends StatefulWidget {
  final LatLng initialCenter;

  const ParkingMapPickerScreen({
    Key? key,
    required this.initialCenter,
  }) : super(key: key);

  @override
  State<ParkingMapPickerScreen> createState() => _ParkingMapPickerScreenState();
}

class _ParkingMapPickerScreenState extends State<ParkingMapPickerScreen> {
  LatLng? _selectedPoint;

  @override
  void initState() {
    super.initState();
    _selectedPoint = widget.initialCenter;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Pick parking location'),
        centerTitle: true,
      ),
      body: FlutterMap(
        options: MapOptions(
          initialCenter: widget.initialCenter,
          initialZoom: 17,
          onTap: (tapPosition, point) {
            setState(() {
              _selectedPoint = point;
            });
          },
        ),
        children: [
          TileLayer(
            urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
            userAgentPackageName: 'com.example.myapp1', // your package name
          ),
          if (_selectedPoint != null)
            MarkerLayer(
              markers: [
                Marker(
                  point: _selectedPoint!,
                  width: 40,
                  height: 40,
                  child: const Icon(
                    Icons.local_parking,
                    color: Colors.red,
                    size: 32,
                  ),
                ),
              ],
            ),
        ],
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: SizedBox(
            height: 44,
            child: FilledButton.icon(
              onPressed: _selectedPoint == null
                  ? null
                  : () {
                      Navigator.of(context).pop(_selectedPoint);
                    },
              icon: const Icon(Icons.check),
              label: const Text('Confirm location'),
            ),
          ),
        ),
      ),
    );
  }
}
