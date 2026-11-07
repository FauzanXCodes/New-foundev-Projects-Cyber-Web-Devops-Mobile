# Panthers Marketplace 🐆💲🎓

Panthers Marketplace is an iOS marketplace built exclusively for Florida International University (FIU) students.

The platform allows students to buy and sell used items within the FIU community, helping students save money by purchasing second-hand products while giving other students an easy way to earn money from items they no longer need.

Unlike general-purpose marketplaces, Panthers Marketplace is designed around a university-verified community. User registration is restricted to valid FIU email addresses, helping keep the marketplace limited to FIU students.

### Purpose

College students frequently need textbooks, electronics, furniture, clothing, school supplies, and other items while trying to keep expenses low. At the same time, students often own items they no longer use that could be useful to someone else on campus.

Panthers Marketplace connects these two groups:

* Buyers can find affordable second-hand products from other FIU students.
* Sellers can earn money by listing items they no longer need.
* Students interact within a marketplace designed specifically for their university community.

The goal is to create a more affordable and convenient way for students to exchange goods while promoting reuse within the FIU community.

### Student Marketplace

Students can use the platform to buy and sell second-hand goods within their university community. Typical marketplace categories can include:

* Textbooks
* Electronics
* Furniture
* Clothing
* School supplies
* Dorm and apartment items
* Other student essentials

### Project Documentation

- Project Documentation & Development Plan:  https://app.notion.com/p/FIU-Marketplace-iOS-278bf89a4a5880458800d6a5b0cd3bde?source=copy_link

- User Flow Diagram:
<img width="1281" height="688" alt="Screenshot 2026-09-22 at 11 05 40 PM" src="https://github.com/user-attachments/assets/1079e487-b2a9-4843-bf2f-7c919c804570" />

### Tech Stack

**iOS**

* Swift
* SwiftUI
* Xcode
* MVVM architecture

**Backend**

* Supabase
* Supabase Authentication
* Supabase Swift SDK

**Testing**

* XCTest
* XCUITest


### Environment Configuration

The application requires a Supabase project.

Configure the following environment variables:

SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_PROJECT_REF=your_project_reference

Sensitive backend credentials should never be committed directly to the repository.

### Running the Application

Requirements

* macOS
* Xcode
* Swift
* iOS Simulator or physical iOS device
* Supabase project

Clone the repository:
```
git clone https://github.com/jcasa28/PanthersMarketplace.git
```
Enter the project:
```
cd PanthersMarketplace
```
Open it in Xcode

Configure the Supabase environment variables, select an iOS simulator or physical device, and run the application through Xcode.


### Key Features

FIU-Only Registration

Panthers Marketplace is designed as a closed marketplace for the FIU community.

Authentication is handled through Supabase, and account registration is restricted to users with an authorized FIU email address.
```
User Registration
       │
       ▼
Enter FIU Email
       │
       ▼
Email Validation
       │
   ┌───┴────┐
   │        │
 Valid    Invalid
   │        │
   ▼        ▼
Create    Reject
Account   Registration

```

This prevents users outside the FIU community from creating regular marketplace accounts.


## Project Structure
```
PanthersMarketplace/
│
├── Panthers Marketplace/
│   └── Main iOS application
│
├── Panthers Marketplace.xcodeproj/
│   └── Xcode project configuration
│
├── Panthers MarketplaceTests/
│   └── Unit tests
│
├── Panthers MarketplaceUITests/
│   └── UI tests
│
├── supabase/
│   ├── Environment.swift
│   ├── SupabaseConfig.swift
│   └── config.toml
│
├── AuthViewModel.swift
├── ProfileView.swift
├── ProfileViewModel.swift
└── README.md
```


