# 🚀 Welcome to Unlink! (Developer Onboarding Guide)

Welcome to the **Unlink** Application repository! This document is designed to give you a quick, simple, and high-level understanding of what this project is, how it's structured, and how the core components work together. You won't need to read every single file to get started—just skim through this guide!

---

## 📱 What is this project?
Unlink is a high-performance **Application & Focus Blocker** built primarily using React Native / Expo. The app helps users manage their screen time by blocking distracting apps instantly when limits are reached or a focus block is active. 

Our core philosophy is **zero-latency blocking** (the "Vantablack" engine). We hook into native Android/iOS APIs to provide an instantaneous block screen, preventing users from seeing even a split second of the blocked app.

---

## 🏗️ High-Level Architecture
Unlink uses a few key technologies:
- **React Native / Expo**: The core framework for building our UI across platforms.
- **NativeWind / Tailwind CSS**: We use Tailwind along with `global.css` for styling, giving us a clean, high-contrast, premium dark mode aesthetic.
- **React Navigation**: For managing screens and modals.
- **Custom Native Modules**: For the heavy lifting that React Native can't do (like OS-level app blocking).

---

## 📂 Folder Structure & Components
Here is a breakdown of where things live and what they do:

### 1. `App.tsx` (The Entry Point)
This is the root of the application. It wraps the app with necessary context providers (like formatting our navigation and loading our fonts) and renders the main user interface.

### 2. `components/` (The Building Blocks)
This is where the visual elements of the application live. We structure them logically:
- **`screens/`**: The main pages of the app (e.g., `BlocksScreen.tsx`, which shows your active focus blocks).
- **`blocks/`**: UI components specific to the app blocking feature. Things like `RuleCreationModal.tsx` (for creating a new block rule) and `AppSelectionModal.tsx` (for selecting which apps to block).
- **`ui/`**: Reusable, generic UI components (buttons, text inputs, headers) that are used everywhere.
- **`settings/` & `home/`**: Components specific to those domains of the app.

### 3. `context/` (Global App State)
We use React Context to manage the global state of the app without explicitly passing props down multiple levels.
- **`BlockingContext.tsx`**: Manages the current state of active blocks, user rules, and app restrictions.
- **`SelectionContext.tsx`**: Manages the state when a user is actively choosing which apps they want to focus on or block.

### 4. `modules/` (The Native Engine)
This is where the magic happens! 
- **`screen-time/`**: This contains our custom native bridges (Swift/Kotlin) that talk directly to iOS and Android OS. When the UI asks to block an app, it sends a command down to this native module to execute the zero-latency block.

### 5. `core/` & `services/`
- **`core/`**: Houses utility functions and SDK-related logic.
- **`services/`**: API calls, background workers, or anything that fetches/sends data outside the app UI.

---

## ⚙️ How it all works together (A Simple Flow)

1. **User Creates a Block**: The user taps "Create Rule" in the UI. They interact with `RuleCreationModal.tsx` and `AppSelectionModal.tsx` (found in `components/blocks/`).
2. **State Updates**: The UI calls a function from `BlockingContext.tsx` to save the new rule.
3. **Native Engine Kicks In**: Behind the scenes, the context tells our native `screen-time` module to enforce the block at the OS level.
4. **App Blocked**: If the user tries to open a restricted app like Instagram, the native layer intercepts it instantly and displays our "Vantablack" block screen.

---

## 🏃‍♂️ Getting Started

1. Run `npm install` to install dependencies.
2. Run `npm start` or `npm run android` / `npm run ios` to launch the Expo development server.
3. Start poking around in `components/blocks/` and `App.tsx` to see how the UI wires together!

*If you have questions, look into the Git History or ask the team!*
