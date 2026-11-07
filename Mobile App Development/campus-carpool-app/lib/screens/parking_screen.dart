import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';

import '../models/parking_spot.dart';
import 'parking_map_picker_screen.dart';

/// MODULE 4 – Parking & Favourites
///
/// - Add parking spots with name, area, note
/// - Choose exact location on map
/// - Mark/unmark favourites
class ParkingScreen extends StatefulWidget {
  const ParkingScreen({Key? key}) : super(key: key);

  @override
  State<ParkingScreen> createState() => _ParkingScreenState();
}

class _ParkingScreenState extends State<ParkingScreen> {
  final List<ParkingSpot> _parkingSpots = [];

  final TextEditingController _nameController = TextEditingController();
  final TextEditingController _areaController = TextEditingController();
  final TextEditingController _noteController = TextEditingController();

  LatLng? _chosenLocation;

  // Default center: St. Xavier's area (you can change)
  static const LatLng _defaultCenter = LatLng(18.9434, 72.8338);

  @override
  void dispose() {
    _nameController.dispose();
    _areaController.dispose();
    _noteController.dispose();
    super.dispose();
  }

  Future<void> _pickLocationOnMap() async {
    final LatLng initial =
        _chosenLocation ?? _defaultCenter; // use last chosen or default

    final result = await Navigator.of(context).push<LatLng>(
      MaterialPageRoute(
        builder: (_) => ParkingMapPickerScreen(initialCenter: initial),
      ),
    );

    if (result != null) {
      setState(() {
        _chosenLocation = result;
      });
    }
  }

  void _addParkingSpot() {
    final name = _nameController.text.trim();
    final area = _areaController.text.trim();
    final note = _noteController.text.trim();

    if (name.isEmpty || area.isEmpty || _chosenLocation == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please enter name, area and choose a location on map'),
        ),
      );
      return;
    }

    final newSpot = ParkingSpot(
      name: name,
      area: area,
      note: note,
      latitude: _chosenLocation!.latitude,
      longitude: _chosenLocation!.longitude,
    );

    setState(() {
      _parkingSpots.add(newSpot);
      _nameController.clear();
      _areaController.clear();
      _noteController.clear();
      _chosenLocation = null;
    });

    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Parking spot added')),
    );
  }

  void _toggleFavourite(int index) {
    setState(() {
      _parkingSpots[index].isFavourite = !_parkingSpots[index].isFavourite;
    });
  }

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    final favouriteSpots =
        _parkingSpots.where((spot) => spot.isFavourite).toList();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Parking & favourites'),
        centerTitle: true,
      ),
      body: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: [
              Colors.indigo.shade50,
              Colors.indigo.shade100,
            ],
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
          ),
        ),
        child: Column(
          children: [
            const SizedBox(height: 8),
            // Header
            const ListTile(
              leading: Icon(Icons.local_parking, size: 30),
              title: Text(
                'My parking spots',
                style: TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.w700,
                ),
              ),
              subtitle: Text('Add, mark and view your favourite spots.'),
            ),

            // Form area
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
              child: Card(
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                ),
                elevation: 3,
                child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      const Text(
                        'Add parking spot',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const SizedBox(height: 8),
                      TextField(
                        controller: _nameController,
                        decoration: const InputDecoration(
                          labelText: 'Spot name',
                          hintText: 'e.g. College Parking',
                          border: OutlineInputBorder(),
                        ),
                      ),
                      const SizedBox(height: 8),
                      TextField(
                        controller: _areaController,
                        decoration: const InputDecoration(
                          labelText: 'Area / landmark',
                          hintText: 'e.g. Corporation Street gate',
                          border: OutlineInputBorder(),
                        ),
                      ),
                      const SizedBox(height: 8),
                      TextField(
                        controller: _noteController,
                        decoration: const InputDecoration(
                          labelText: 'Note (optional)',
                          hintText: 'e.g. Shaded, safe, 2 min walk',
                          border: OutlineInputBorder(),
                        ),
                      ),
                      const SizedBox(height: 8),
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              _chosenLocation == null
                                  ? 'No location chosen'
                                  : 'Location: '
                                    '${_chosenLocation!.latitude.toStringAsFixed(4)}, '
                                    '${_chosenLocation!.longitude.toStringAsFixed(4)}',
                              style: const TextStyle(fontSize: 13),
                            ),
                          ),
                          const SizedBox(width: 8),
                          OutlinedButton.icon(
                            onPressed: _pickLocationOnMap,
                            icon: const Icon(Icons.map_outlined),
                            label: const Text('Pick on map'),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      SizedBox(
                        height: 40,
                        child: FilledButton.icon(
                          onPressed: _addParkingSpot,
                          icon: const Icon(Icons.add),
                          label: const Text('Add parking spot'),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),

            const SizedBox(height: 4),

            // List of spots
            Expanded(
              child: _parkingSpots.isEmpty
                  ? const Center(
                      child: Text(
                        'No parking spots yet.\nAdd one using the form above.',
                        textAlign: TextAlign.center,
                      ),
                    )
                  : ListView.builder(
                      itemCount: _parkingSpots.length,
                      itemBuilder: (context, index) {
                        final spot = _parkingSpots[index];
                        final position = LatLng(
                          spot.latitude,
                          spot.longitude,
                        );
                        return Card(
                          margin: const EdgeInsets.symmetric(
                            horizontal: 12,
                            vertical: 6,
                          ),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(16),
                          ),
                          elevation: 2,
                          child: ListTile(
                            leading: CircleAvatar(
                              backgroundColor: colorScheme.primaryContainer,
                              child: Icon(
                                Icons.local_parking,
                                color: colorScheme.onPrimaryContainer,
                              ),
                            ),
                            title: Text(
                              spot.name,
                              style: const TextStyle(
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                            subtitle: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(spot.area),
                                if (spot.note.isNotEmpty)
                                  Text(
                                    spot.note,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                Text(
                                  'Lat: ${position.latitude.toStringAsFixed(4)}, '
                                  'Lng: ${position.longitude.toStringAsFixed(4)}',
                                  style: const TextStyle(fontSize: 11),
                                ),
                              ],
                            ),
                            isThreeLine: true,
                            trailing: IconButton(
                              icon: Icon(
                                spot.isFavourite
                                    ? Icons.favorite
                                    : Icons.favorite_border,
                                color: spot.isFavourite
                                    ? Colors.red
                                    : Colors.grey,
                              ),
                              onPressed: () => _toggleFavourite(index),
                              tooltip: 'Toggle favourite',
                            ),
                            onTap: () {
                              // Open small map dialog showing this spot
                              showDialog(
                                context: context,
                                builder: (_) {
                                  return AlertDialog(
                                    title: Text(spot.name),
                                    content: SizedBox(
                                      width: 300,
                                      height: 250,
                                      child: FlutterMap(
                                        options: MapOptions(
                                          initialCenter: position,
                                          initialZoom: 18,
                                        ),
                                        children: [
                                          TileLayer(
                                            urlTemplate:
                                                'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                                            userAgentPackageName:
                                                'com.example.myapp1',
                                          ),
                                          MarkerLayer(
                                            markers: [
                                              Marker(
                                                point: position,
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
                                    ),
                                    actions: [
                                      TextButton(
                                        onPressed: () =>
                                            Navigator.of(context).pop(),
                                        child: const Text('Close'),
                                      ),
                                    ],
                                  );
                                },
                              );
                            },
                          ),
                        );
                      },
                    ),
            ),

            // Favourite summary
            if (favouriteSpots.isNotEmpty)
              Padding(
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                child: Align(
                  alignment: Alignment.centerLeft,
                  child: Text(
                    'Favourites: ${favouriteSpots.length}',
                    style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
