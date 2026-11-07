import 'package:flutter/material.dart';
import 'my_rides_screen.dart';
import 'campus_map_screen.dart';



class Ride {
  final String from;
  final String to;
  final String date;
  final String time;
  final int seats;
  final String note;
  final String createdBy; // new

  Ride({
    required this.from,
    required this.to,
    required this.date,
    required this.time,
    required this.seats,
    required this.note,
    required this.createdBy,
  });
}


class RideBoardScreen extends StatefulWidget {
  const RideBoardScreen({Key? key}) : super(key: key);

  @override
  State<RideBoardScreen> createState() => _RideBoardScreenState();
}

class _RideBoardScreenState extends State<RideBoardScreen> {
  final List<Ride> _rides = [];

  final _fromController = TextEditingController();
  final _toController = TextEditingController();
  final _dateController = TextEditingController();
  final _timeController = TextEditingController();
  final _seatsController = TextEditingController();
  final _noteController = TextEditingController();

  final _formKey = GlobalKey<FormState>();

  @override
  void dispose() {
    _fromController.dispose();
    _toController.dispose();
    _dateController.dispose();
    _timeController.dispose();
    _seatsController.dispose();
    _noteController.dispose();
    super.dispose();
  }

  void _addRide() {
    if (!_formKey.currentState!.validate()) return;

    final seats = int.tryParse(_seatsController.text.trim()) ?? 1;

  final ride = Ride(
  from: _fromController.text.trim(),
  to: _toController.text.trim(),
  date: _dateController.text.trim(),
  time: _timeController.text.trim(),
  seats: seats,
  note: _noteController.text.trim(),
  createdBy: 'Me', // TODO: replace with actual user name
);

    setState(() => _rides.add(ride));

    _fromController.clear();
    _toController.clear();
    _dateController.clear();
    _timeController.clear();
    _seatsController.clear();
    _noteController.clear();

    Navigator.of(context).pop(); // close bottom sheet

    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Ride added to board')),
    );
  }

  void _openCreateRideSheet() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (context) {
        final viewInsets = MediaQuery.of(context).viewInsets;
        return Padding(
          padding: EdgeInsets.only(
            left: 16,
            right: 16,
            top: 16,
            bottom: viewInsets.bottom + 16,
          ),
          child: SingleChildScrollView(
            child: Form(
              key: _formKey,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Row(
                    children: [
                      const Icon(Icons.directions_car_filled),
                      const SizedBox(width: 8),
                      const Text(
                        'Create a ride',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const Spacer(),
                      IconButton(
                        icon: const Icon(Icons.close),
                        onPressed: () => Navigator.of(context).pop(),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),

                  TextFormField(
                    controller: _fromController,
                    decoration: const InputDecoration(
                      labelText: 'From (e.g. Hostel A)',
                      prefixIcon: Icon(Icons.location_pin),
                      border: OutlineInputBorder(),
                    ),
                    validator: (v) =>
                        v == null || v.trim().isEmpty
                            ? 'Enter starting point'
                            : null,
                  ),
                  const SizedBox(height: 12),

                  TextFormField(
                    controller: _toController,
                    decoration: const InputDecoration(
                      labelText: 'To (e.g. Main Campus)',
                      prefixIcon: Icon(Icons.flag),
                      border: OutlineInputBorder(),
                    ),
                    validator: (v) =>
                        v == null || v.trim().isEmpty
                            ? 'Enter destination'
                            : null,
                  ),
                  const SizedBox(height: 12),

                  Row(
                    children: [
                      Expanded(
                        child: TextFormField(
                          controller: _dateController,
                          decoration: const InputDecoration(
                            labelText: 'Date',
                            hintText: '2026-01-20',
                            prefixIcon: Icon(Icons.event),
                            border: OutlineInputBorder(),
                          ),
                          validator: (v) =>
                              v == null || v.trim().isEmpty
                                  ? 'Enter date'
                                  : null,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: TextFormField(
                          controller: _timeController,
                          decoration: const InputDecoration(
                            labelText: 'Time',
                            hintText: '08:30 AM',
                            prefixIcon: Icon(Icons.schedule),
                            border: OutlineInputBorder(),
                          ),
                          validator: (v) =>
                              v == null || v.trim().isEmpty
                                  ? 'Enter time'
                                  : null,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),

                  Row(
                    children: [
                      Expanded(
                        child: TextFormField(
                          controller: _seatsController,
                          keyboardType: TextInputType.number,
                          decoration: const InputDecoration(
                            labelText: 'Seats',
                            prefixIcon: Icon(Icons.chair),
                            border: OutlineInputBorder(),
                          ),
                          validator: (v) {
                            if (v == null || v.trim().isEmpty) {
                              return 'Enter seats';
                            }
                            final n = int.tryParse(v.trim());
                            if (n == null || n <= 0) {
                              return 'Seats must be > 0';
                            }
                            return null;
                          },
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: TextFormField(
                          controller: _noteController,
                          decoration: const InputDecoration(
                            labelText: 'Note (optional)',
                            border: OutlineInputBorder(),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),

                  SizedBox(
                    width: double.infinity,
                    child: FilledButton.icon(
                      onPressed: _addRide,
                      icon: const Icon(Icons.check),
                      label: const Text('Post ride'),
                    ),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }

    @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Ride board'),
        centerTitle: true,
        actions: [
          IconButton(
            icon: const Icon(Icons.list_alt),
            tooltip: 'My rides',
            onPressed: () {
              Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (_) => MyRidesScreen(allRides: _rides),
                ),
              );
            },
          ),
        ],
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
            const ListTile(
              leading: Icon(Icons.directions_car_filled, size: 30),
              title: Text(
                'College rides',
                style: TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.w700,
                ),
              ),
              subtitle: Text('Post or join rides within your campus.'),
            ),
            const SizedBox(height: 4),
            Expanded(
              child: AnimatedSwitcher(
                duration: const Duration(milliseconds: 250),
                child: _rides.isEmpty
                    ? const Center(
                        key: ValueKey('empty'),
                        child: Text(
                          'No rides yet.\nTap the + button to post a ride.',
                          textAlign: TextAlign.center,
                          style: TextStyle(fontSize: 15),
                        ),
                      )
                    : ListView.builder(
                        key: const ValueKey('list'),
                        itemCount: _rides.length,
                        itemBuilder: (context, index) {
                          final ride = _rides[index];
                          return TweenAnimationBuilder<double>(
                            tween: Tween(begin: 0.97, end: 1),
                            duration:
                                const Duration(milliseconds: 200),
                            builder: (context, value, child) {
                              return Transform.scale(
                                scale: value,
                                child: child,
                              );
                            },
                            child: Card(
                              margin: const EdgeInsets.symmetric(
                                horizontal: 12,
                                vertical: 6,
                              ),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(16),
                              ),
                              elevation: 3,
                              child: ListTile(
                                leading: CircleAvatar(
                                  backgroundColor:
                                      colorScheme.primaryContainer,
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
                                  crossAxisAlignment:
                                      CrossAxisAlignment.start,
                                  children: [
                                    const SizedBox(height: 4),
                                    Row(
                                      children: [
                                        const Icon(Icons.event,
                                            size: 16),
                                        const SizedBox(width: 4),
                                        Text(ride.date),
                                        const SizedBox(width: 12),
                                        const Icon(Icons.schedule,
                                            size: 16),
                                        const SizedBox(width: 4),
                                        Text(ride.time),
                                      ],
                                    ),
                                    const SizedBox(height: 4),
                                    Row(
                                      children: [
                                        Chip(
                                          label: Text(
                                              'Seats: ${ride.seats}'),
                                          visualDensity: VisualDensity
                                              .compact,
                                          materialTapTargetSize:
                                              MaterialTapTargetSize
                                                  .shrinkWrap,
                                        ),
                                        if (ride.note.isNotEmpty)
                                          const SizedBox(width: 8),
                                        if (ride.note.isNotEmpty)
                                          Flexible(
                                            child: Text(
                                              ride.note,
                                              maxLines: 1,
                                              overflow: TextOverflow
                                                  .ellipsis,
                                            ),
                                          ),
                                      ],
                                    ),
                                  ],
                                ),
                                isThreeLine: true,
                                trailing: IconButton(
                                  icon: const Icon(
                                    Icons.delete_outline,
                                    color: Colors.redAccent,
                                  ),
                                  onPressed: () =>
                                      setState(() => _rides.removeAt(index)),
                                  tooltip: 'Delete ride',
                                ),
                              ),
                            ),
                          );
                        },
                      ),
              ),
            ),
          ],
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _openCreateRideSheet,
        icon: const Icon(Icons.add),
        label: const Text('New ride'),
      ),
    );
  }
}
