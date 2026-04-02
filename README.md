# SongLyrics Projection System

A professional, real-time church lyrics and multimedia presentation system built with **Flask**, **SQLAlchemy**, and **Socket.io**. Designed for low-latency OBS integration via Browser Source.

## Support This Project

If this system helps your church or production team, you can support development:

• PayPal: https://www.paypal.me/red1103
### GCash
Scan the QR code below:

![GCash QR](assets/gcash-qr.jpg)


Your support helps maintain and improve this free and open-source project.


## ✨ Features

-   **🎵 Song Library**: Advanced search by title, author, or lyrics. Easy "Add Song" workflow with custom section tags
      - [I1.1] = Intro (.1 .2 .3 .4 are sections)
      - [V1.1] = Verse 1
      - [V2.1] = Verse 2
      - [C1.1] = Chorus 1
      - [PC1.1] = Pre Chorus
      - [B1.1] = Bridge
      - [R1.1] = Refrain
      - [T1.1] = Tag
   - you can map keyboard shortcut for each tag for fast song lyrics navigation (under setting > shortcuts)
   - example V1.1 mapped to letter "V"

    support HTML tags (just enclose with ## <html> ##)

-   **📋 Service Lineup**: Build and reorder your service lineup with drag-and-drop.
-   **📺 Real-time Projection**: Push lyrics to OBS or any screen instantly using Socket.io—no refresh required.
      output = 'http://localhost:5002/output'
    
-   **🪄 Dynamic Styling**: Customize font, size, shadows, and **real-time text borders** for both normal and emphasized text.
-   **📖 Bible Module**: Search and project Bible verses with support for parallel translations.
-   **📢 Announcements & Birthdays**: Dedicated managers for automated announcements and birthday celebrant slides.
      Annoucements support HTML code (example: you can project your html countdown timer)
    
-   **🎞️ Media Library**: Manage and project background videos, images, and even web URLs.
      - for youtube video use embed  example:
      - 'https://www.youtube.com/embed/"videocode"autoplay=1&mute=0&loop=1&playlist="videocode"&controls=0'
      - replace "videocode" with youtube url identifier
      - you can add live video feed as media through vdo.ninja then add the url (put all live feed under "livefeed" folder in order for you to view them realtime -there is slight delay when switching livefeed)
-   **🖥️ OBS Optimized**: Native transparent output mode designed for OBS Browser Sources.

## 🚀 Getting Started

### Prerequisites

-   Python 3.10+
-   `pip` (Python package manager)

### Installation

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/xhinixhi/Project-ProjectionV1.0.git
    cd Project-ProjectionV1.0
    ```

2.  **Create a virtual environment**:
    ```bash
    python -m venv venv
    source venv/bin/activate  # On Windows use: venv\Scripts\activate
    ```

3.  **Install dependencies**:
    ```bash
    pip install -r requirements.txt
    ```

4.  **Initialize the Database**:
    The system uses a local SQLite database. On first run, it will automatically create a clean `app.db`.
    ```bash
    python run.py
    ```

### Access URLs

-   **Controller Interface**: `http://localhost:5002/control` (The main operator panel)
-   **Projection Output**: `http://localhost:5002/output` (The screen you project or add to OBS)

## 🎨 Customizing the Output

1. Open the **Controller** and go to the **Settings** or **Styling** panel.
2. Adjust your colors, fonts, and borders.
3. Observations are reflected in real-time on any connected `/output` screen.

## 🤝 Contributing

Contributions are welcome! Feel free to open an issue or submit a pull request.

## ⚖️ License

Distributed under the MIT License. See `LICENSE` for more information.

## ⚠️ Disclaimer

This software is a tool for presenting content. The author does not provide copyrighted lyrics or Bible translations. Users are responsible for ensuring they have the legal right to project the materials they add to the system.
