import 'package:flutter/material.dart';
import 'ride_board_screen.dart'; // for Ride class

/// MODULE 3 – My Rides
/// Shows only rides created by the user (for now we filter by createdBy == 'Me')
class MyRidesScreen extends StatelessWidget {
  final List<Ride> allRides;

  const MyRidesScreen({
    Key? key,
    required this.allRides,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    // Filter rides that belong to current user
    final myRides = allRides.where((r) => r.createdBy == 'Me').toList();

    return Scaffold(
      appBar: AppBar(
        title: const Text('My rides'),
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
        child: myRides.isEmpty
            ? const Center(
                child: Text(
                  'You have not posted any rides yet.\nCreate a ride from the Ride Board.',
                  textAlign: TextAlign.center,
                ),
              )
            : ListView.builder(
                padding: const EdgeInsets.all(12),
                itemCount: myRides.length,
                itemBuilder: (context, index) {
                  final ride = myRides[index];
                  return Card(
                    margin: const EdgeInsets.symmetric(
                      horizontal: 4,
                      vertical: 6,
                    ),
                    elevation: 3,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: ListTile(
                      leading: CircleAvatar(
                        backgroundColor: colorScheme.primaryContainer,
                        child: Icon(
                          Icons.directions_car,
                          color: colorScheme.onPrimaryContainer,
                        ),
                      ),
                      title: Text(
                        '${ride.from} → ${ride.to}',
                        style: const TextStyle(
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      subtitle: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const SizedBox(height: 4),
                          Row(
                            children: [
                              const Icon(Icons.event, size: 16),
                              const SizedBox(width: 4),
                              Text(ride.date),
                              const SizedBox(width: 12),
                              const Icon(Icons.schedule, size: 16),
                              const SizedBox(width: 4),
                              Text(ride.time),
                            ],
                          ),
                          const SizedBox(height: 4),
                          Text(
                            'Seats: ${ride.seats}'
                            '${ride.note.isNotEmpty ? " • ${ride.note}" : ""}',
                          ),
                        ],
                      ),
                      isThreeLine: true,
                    ),
                  );
                },
              ),
      ),
    );
  }
}
