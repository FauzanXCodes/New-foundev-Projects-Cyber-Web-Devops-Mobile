import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';

class CampusMapScreen extends StatelessWidget {
  const CampusMapScreen({Key? key}) : super(key: key);




static const LatLng _campusCenter = LatLng(18.9434, 72.8338);

// Nearby pickup markers around the school / college
static const LatLng _hostelPickup = LatLng(18.9439, 72.8342); // slight NE
static const LatLng _gatePickup   = LatLng(18.9429, 72.8334); 



  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Campus map'),
        centerTitle: true,
      ),
      body: FlutterMap(
        options: const MapOptions(
          initialCenter: _campusCenter,
          initialZoom: 16,
        ),
        children: [
          // OpenStreetMap tiles - free, no key needed
          TileLayer(
            urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
            userAgentPackageName: 'com.example.myapp1', // change to your package
          ),
          MarkerLayer(
            markers: [
              Marker(
                point: _campusCenter,
                width: 40,
                height: 40,
                child: const Icon(
                  Icons.location_city,
                  color: Colors.indigo,
                  size: 32,
                ),
              ),
              Marker(
                point: _hostelPickup,
                width: 40,
                height: 40,
                child: const Icon(
                  Icons.home_filled,
                  color: Colors.green,
                  size: 28,
                ),
              ),
              Marker(
                point: _gatePickup,
                width: 40,
                height: 40,
                child: const Icon(
                  Icons.directions_car_filled,
                  color: Colors.red,
                  size: 28,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
