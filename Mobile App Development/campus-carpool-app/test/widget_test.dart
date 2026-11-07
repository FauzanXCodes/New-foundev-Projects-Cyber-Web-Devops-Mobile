import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:myapp1/main.dart';  

void main() {
  testWidgets('app builds without crashing', (WidgetTester tester) async {
    // Build your app and trigger a frame.
    await tester.pumpWidget(const CollegeCarpoolApp());

    // Simple smoke test: at least one widget is found.
    expect(find.byType(MaterialApp), findsOneWidget);
  });
}
