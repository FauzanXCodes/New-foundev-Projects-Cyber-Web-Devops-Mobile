import 'package:flutter/material.dart';
import '../models/user_profile.dart';
import '../services/profile_storage.dart';
import '../main.dart'; // for MainShell

class ProfileFormScreen extends StatefulWidget {
  const ProfileFormScreen({Key? key}) : super(key: key);

  @override
  State<ProfileFormScreen> createState() => _ProfileFormScreenState();
}

class _ProfileFormScreenState extends State<ProfileFormScreen> {
  final _formKey = GlobalKey<FormState>();

  final _nameController = TextEditingController();
  final _rollController = TextEditingController();
  final _deptController = TextEditingController();
  final _phoneController = TextEditingController();
  final _vehicleModelController = TextEditingController();
  final _vehiclePlateController = TextEditingController();

  String _vehicleType = 'Car';
  bool _hasVehicle = true;
  bool _profileCompleted = false;

  @override
  void initState() {
    super.initState();
    _loadExistingProfile();
  }

  Future<void> _loadExistingProfile() async {
    final completed = await ProfileStorage.isProfileCompleted();
    final existing = await ProfileStorage.loadProfile();

    if (!mounted) return;

    if (existing != null) {
      _nameController.text = existing.name;
      _rollController.text = existing.rollNumber;
      _deptController.text = existing.department;
      _phoneController.text = existing.phone;
      if (existing.vehicle != null) {
        _hasVehicle = true;
        _vehicleType = existing.vehicle!.type;
        _vehicleModelController.text = existing.vehicle!.model;
        _vehiclePlateController.text = existing.vehicle!.plateNo;
      } else {
        _hasVehicle = false;
      }
    }

    setState(() {
      _profileCompleted = completed;
    });
  }

  @override
  void dispose() {
    _nameController.dispose();
    _rollController.dispose();
    _deptController.dispose();
    _phoneController.dispose();
    _vehicleModelController.dispose();
    _vehiclePlateController.dispose();
    super.dispose();
  }

  Future<void> _saveProfile() async {
    if (!_formKey.currentState!.validate()) {
      return;
    }

    VehicleInfo? vehicle;
    if (_hasVehicle) {
      vehicle = VehicleInfo(
        type: _vehicleType,
        model: _vehicleModelController.text.trim(),
        plateNo: _vehiclePlateController.text.trim(),
      );
    }

    final profile = UserProfile(
      name: _nameController.text.trim(),
      rollNumber: _rollController.text.trim(),
      department: _deptController.text.trim(),
      phone: _phoneController.text.trim(),
      vehicle: vehicle,
    );

    await ProfileStorage.saveProfile(profile);

    if (!mounted) return;

    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Profile saved')),
    );

    Navigator.of(context).pushReplacement(
      MaterialPageRoute(builder: (_) => const MainShell()),
    );
  }

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final readOnly = _profileCompleted;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Profile'),
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
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(18),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.05),
                  blurRadius: 12,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: Form(
              key: _formKey,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    children: [
                      CircleAvatar(
                        radius: 24,
                        backgroundColor: colorScheme.primaryContainer,
                        child: Icon(
                          Icons.person,
                          color: colorScheme.onPrimaryContainer,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'Student profile',
                              style: TextStyle(
                                fontSize: 20,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                            Text(
                              readOnly
                                  ? 'Profile locked. Contact admin to change.'
                                  : 'Fill once. Used in rides and parking.',
                              style: const TextStyle(
                                fontSize: 13,
                                color: Colors.black54,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),

                  const SizedBox(height: 20),

                  const Text(
                    'Student information',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 8),

                  TextFormField(
                    controller: _nameController,
                    readOnly: readOnly,
                    decoration: const InputDecoration(
                      labelText: 'Full name',
                      prefixIcon: Icon(Icons.badge_outlined),
                      border: OutlineInputBorder(),
                    ),
                    validator: readOnly
                        ? null
                        : (value) {
                            if (value == null || value.trim().isEmpty) {
                              return 'Please enter your name';
                            }
                            return null;
                          },
                  ),
                  const SizedBox(height: 12),

                  TextFormField(
                    controller: _rollController,
                    readOnly: readOnly,
                    decoration: const InputDecoration(
                      labelText: 'Roll number',
                      prefixIcon: Icon(Icons.confirmation_number_outlined),
                      border: OutlineInputBorder(),
                    ),
                    validator: readOnly
                        ? null
                        : (value) {
                            if (value == null || value.trim().isEmpty) {
                              return 'Roll number is required';
                            }
                            return null;
                          },
                  ),
                  const SizedBox(height: 12),

                  TextFormField(
                    controller: _deptController,
                    readOnly: readOnly,
                    decoration: const InputDecoration(
                      labelText: 'Department',
                      hintText: 'e.g. BSc IT, CS, EXTC',
                      prefixIcon: Icon(Icons.school_outlined),
                      border: OutlineInputBorder(),
                    ),
                  ),

                  const SizedBox(height: 20),

                  const Text(
                    'Contact',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 8),

                  TextFormField(
                    controller: _phoneController,
                    readOnly: readOnly,
                    keyboardType: TextInputType.phone,
                    decoration: const InputDecoration(
                      labelText: 'Phone number',
                      prefixIcon: Icon(Icons.phone_iphone),
                      border: OutlineInputBorder(),
                    ),
                    validator: readOnly
                        ? null
                        : (value) {
                            if (value == null || value.trim().isEmpty) {
                              return 'Phone number is required';
                            }
                            if (value.trim().length < 10) {
                              return 'Enter a valid phone number';
                            }
                            return null;
                          },
                  ),

                  const SizedBox(height: 20),

                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        'Vehicle details',
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      Row(
                        children: [
                          const Text('Have vehicle?'),
                          const SizedBox(width: 4),
                          Switch(
                            value: _hasVehicle,
                            onChanged: readOnly
                                ? null
                                : (value) {
                                    setState(() => _hasVehicle = value);
                                  },
                          ),
                        ],
                      ),
                    ],
                  ),

                  if (_hasVehicle) ...[
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        const Text('Type:'),
                        const SizedBox(width: 12),
                        DropdownButton<String>(
                          value: _vehicleType,
                          items: const [
                            DropdownMenuItem(
                              value: 'Car',
                              child: Text('Car'),
                            ),
                            DropdownMenuItem(
                              value: 'Bike',
                              child: Text('Bike'),
                            ),
                            DropdownMenuItem(
                              value: 'Other',
                              child: Text('Other'),
                            ),
                          ],
                          onChanged: readOnly
                              ? null
                              : (value) {
                                  if (value == null) return;
                                  setState(() => _vehicleType = value);
                                },
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),

                    TextFormField(
                      controller: _vehicleModelController,
                      readOnly: readOnly,
                      decoration: const InputDecoration(
                        labelText: 'Vehicle model',
                        hintText: 'e.g. Baleno, Splendor',
                        prefixIcon: Icon(Icons.directions_car_outlined),
                        border: OutlineInputBorder(),
                      ),
                    ),
                    const SizedBox(height: 12),

                    TextFormField(
                      controller: _vehiclePlateController,
                      readOnly: readOnly,
                      decoration: const InputDecoration(
                        labelText: 'Vehicle number',
                        hintText: 'e.g. MH12AB1234',
                        prefixIcon: Icon(Icons.numbers),
                        border: OutlineInputBorder(),
                      ),
                    ),
                  ],

                  const SizedBox(height: 24),

                  if (!readOnly)
                    SizedBox(
                      height: 48,
                      child: FilledButton.icon(
                        onPressed: _saveProfile,
                        icon: const Icon(Icons.save_rounded),
                        label: const Text('Save profile'),
                      ),
                    ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
