# SongLyrics Projection System

A professional, real-time church lyrics and multimedia presentation system built with **Flask**, **SQLAlchemy**, and **Socket.io**. Designed for low-latency OBS integration via Browser Source.

![Demo Placeholder](https://via.placeholder.com/1200x600.png?text=SongLyrics+Projection+System+Interface)

## ✨ Features

-   **🎵 Song Library**: Advanced search by title, author, or lyrics. Easy "Add Song" workflow with custom section tags (V1, C1, B1, etc.).
-   **📋 Service Lineup**: Build and reorder your service lineup with drag-and-drop.
-   **📺 Real-time Projection**: Push lyrics to OBS or any screen instantly using Socket.io—no refresh required.
-   **🪄 Dynamic Styling**: Customize font, size, shadows, and **real-time text borders** for both normal and emphasized text.
-   **📖 Bible Module**: Search and project Bible verses with support for parallel translations.
-   **📢 Announcements & Birthdays**: Dedicated managers for automated announcements and birthday celebrant slides.
-   **🎞️ Media Library**: Manage and project background videos, images, and even web URLs.
-   **🖥️ OBS Optimized**: Native transparent output mode designed for OBS Browser Sources.

## 🚀 Getting Started

### Prerequisites

-   Python 3.10+
-   `pip` (Python package manager)

### Installation

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/xhinixhi/song-lyrics-projection.git
    cd song-lyrics-projection
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
