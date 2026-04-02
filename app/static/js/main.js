document.addEventListener('DOMContentLoaded', () => {
    const socket = io({
        transports: ['websocket', 'polling']
    });

    socket.on('connect', () => console.log('Connected to server'));
    socket.on('connect_error', (error) => console.error('Socket error:', error));
    window.socket = socket;

    if (typeof pdfjsLib !== 'undefined') {
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
    }

    window.currentServiceId = null;
    window.currentSongId = null;
    window.currentSectionTag = null;
    window.currentItemType = null;

    // --- Sidebar Toggle Logic ---
    const sidebar = document.getElementById('sidebar');
    const btnToggleSidebar = document.getElementById('btn-toggle-sidebar');
    if (sidebar && btnToggleSidebar) {
        const isMinimized = localStorage.getItem('sidebar-minimized') === 'true';
        if (isMinimized) {
            sidebar.classList.add('minimized');
        }

        // Use a short timeout to remove no-transition, allowing the first layout to happen instantly
        setTimeout(() => {
            sidebar.classList.remove('no-transition');
        }, 100);

        btnToggleSidebar.addEventListener('click', () => {
            sidebar.classList.toggle('minimized');
            localStorage.setItem('sidebar-minimized', sidebar.classList.contains('minimized'));
        });
    }

    // Modal elements
    // --- Universal Modal Helpers & Global Actions ---
    window.transformUrl = (url) => {
        if (!url) return url;
        let tUrl = url.trim();
        // Enforce protocol (default to http for localhost/IP, https otherwise)
        if (!/^https?:\/\//i.test(tUrl)) {
            const isLocal = /^(localhost|127\.0\.0\.1|192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/i.test(tUrl);
            tUrl = (isLocal ? 'http://' : 'https://') + tUrl;
        }

        // YouTube
        const ytRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/;
        const ytMatch = tUrl.match(ytRegex);
        if (ytMatch) {
            return `https://www.youtube.com/embed/${ytMatch[1]}?autoplay=1&mute=1&controls=1&rel=0&modestbranding=1`;
        }

        // Vimeo
        const vimeoRegex = /(?:https?:\/\/)?(?:www\.)?(?:vimeo\.com\/)(\d+)/;
        const vimeoMatch = tUrl.match(vimeoRegex);
        if (vimeoMatch) {
            return `https://player.vimeo.com/video/${vimeoMatch[1]}?autoplay=1&muted=1&background=0`;
        }

        // Twitch
        const twitchRegex = /(?:https?:\/\/)?(?:www\.)?(?:twitch\.tv\/)([a-zA-Z0-9_]+)/;
        const twitchMatch = tUrl.match(twitchRegex);
        if (twitchMatch) {
            const parent = window.location.hostname;
            return `https://player.twitch.tv/?channel=${twitchMatch[1]}&parent=${parent || 'localhost'}&autoplay=true&muted=true`;
        }

        // Facebook Video
        if (tUrl.includes('facebook.com') && (tUrl.includes('/videos/') || tUrl.includes('/watch/'))) {
            return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(tUrl)}&show_text=0&width=560`;
        }

        return tUrl;
    };

    window.showAlert = (message, title = "Notification") => {
        alert(message);
    };

    window.showConfirm = (message, onConfirm, title = "Confirm Action") => {
        if (confirm(message)) {
            onConfirm();
        }
    };

    window.closeModal = (id) => {
        // Obsolete, kept for backwards compatibility if needed
    };

    // --- Output Customization System ---
    function applyStylesToElement(el, styles) {
        if (!el || !styles) return;

        // Animation Settings
        if (styles.transitionStyle) el.dataset.animStyle = styles.transitionStyle;
        if (styles.transitionSpeed) {
            el.dataset.animSpeed = styles.transitionSpeed;
            el.style.transitionDuration = `${styles.transitionSpeed}s`;
        }

        // Standard Styles & CSS Variables
        const styleToApply = { ...styles };
        delete styleToApply.transitionStyle;
        delete styleToApply.transitionSpeed;

        for (const [key, value] of Object.entries(styleToApply)) {
            if (key.startsWith('--')) {
                el.style.setProperty(key, value);
            } else {
                el.style[key] = value;
            }
        }
    }

    // --- Sync Helper for Sliders and Number Inputs ---
    function syncInputs(sliderId, numberId) {
        const slider = document.getElementById(sliderId);
        const number = document.getElementById(numberId);

        if (slider && number) {
            slider.addEventListener('input', () => {
                number.value = slider.value;
                number.dispatchEvent(new Event('input'));
            });
            number.addEventListener('input', () => {
                slider.value = number.value;
                slider.dispatchEvent(new Event('input'));
            });
        }
    }

    window.editBirthday = (id) => {
        window.location.href = `/birthdays/edit/${id}`;
    };

    window.deleteBirthday = (id) => {
        showConfirm("Delete this birthday?", () => {
            fetch(`/birthdays/delete/${id}`, { method: 'POST' })
                .then(() => {
                    // Quick way to reload, or reload functions if they exist on the page
                    if (typeof loadBirthdays === 'function') loadBirthdays();
                    else window.location.reload();
                });
        }, "Confirm Deletion");
    };

    window.editAnnouncement = (id) => {
        window.location.href = `/announcements/edit/${id}`;
    };

    window.deleteAnnouncement = (id) => {
        showConfirm("Delete this announcement?", () => {
            fetch(`/announcements/delete/${id}`, { method: 'POST' })
                .then(() => {
                    if (typeof loadAnnouncements === 'function') loadAnnouncements();
                    else window.location.reload();
                });
        }, "Confirm Deletion");
    };

    window.clearAnnouncementMedia = (id) => {
        showConfirm("Clear default media for this announcement?", () => {
            fetch(`/announcements/${id}/update_media`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: null, type: null })
            }).then(res => res.json())
                .then(data => {
                    if (data.status === 'success') {
                        if (typeof loadAnnouncements === 'function') loadAnnouncements();
                        showAlert("Default media cleared!");
                    }
                });
        }, "Clear Media");
    };

    window.editSong = (songId) => { window.location.href = `/songs/edit/${songId}`; };
    window.editLive = (liveId) => { window.location.href = `/live/edit/${liveId}`; };
    window.editLive2 = (live2Id) => { window.location.href = `/live2/edit/${live2Id}`; };

    window.deleteSong = (e, songId) => {
        if (e) e.stopPropagation();
        showConfirm("Are you sure you want to delete this song? This action cannot be undone.", () => {
            fetch(`/songs/delete/${songId}`, { method: 'POST' }).then(() => {
                const search = document.getElementById('song-search');
                if (typeof loadSongs === 'function') loadSongs(search ? search.value : '');
                else window.location.reload();
            });
        }, "Confirm Deletion");
    };

    window.deleteLive = (e, liveId) => {
        if (e) e.stopPropagation();
        showConfirm("Are you sure you want to delete this Live? This action cannot be undone.", () => {
            fetch(`/live/delete/${liveId}`, { method: 'POST' }).then(() => {
                const search = document.getElementById('live-search');
                if (typeof loadLive === 'function') loadLive(search ? search.value : '');
                else window.location.reload();
            });
        }, "Confirm Deletion");
    };

    window.deleteLive2 = (e, live2Id) => {
        if (e) e.stopPropagation();
        showConfirm("Are you sure you want to delete this Live2? This action cannot be undone.", () => {
            fetch(`/live2/delete/${live2Id}`, { method: 'POST' }).then(() => {
                const search = document.getElementById('live2-search');
                if (typeof loadLive2 === 'function') loadLive2(search ? search.value : '');
                else window.location.reload();
            });
        }, "Confirm Deletion");
    };

    window.deleteBible = (id) => {
        showConfirm("Delete this saved verse?", () => {
            fetch(`/bible/delete/${id}`, { method: 'POST' }).then(() => {
                if (typeof loadBibles === 'function') loadBibles();
                else window.location.reload();
            });
        }, "Confirm Deletion");
    };

    window.projectLatestBible = () => {
        fetch('/bible/data')
            .then(res => res.json())
            .then(bibles => {
                if (bibles && bibles.length > 0) {
                    const b = bibles[0];
                    socket.emit('select_bible', {
                        verse: `${b.verse} ${b.translation ? '(' + b.translation + ')' : ''}`,
                        content: b.content
                    });
                    if (typeof previewBible === 'function') {
                        previewBible(b.id);
                    }
                }
            });
    };

    // Global listener for new bible verse from extension / projection
    socket.on('request_bible_navigation', (data) => {
        const path = window.location.pathname;
        const isBible = path.startsWith('/bible');
        const isOutput = path.startsWith('/output');

        if (isOutput) return; // Output only listens to update_bible_slide

        if (!isBible && !isOutput && !path.startsWith('/editor') && !path.startsWith('/media')) {
            localStorage.setItem('pending_bible_publish', JSON.stringify(data));
            window.location.href = '/bible/?project_latest=true';
            return;
        } else {
            // We are already on the bible page, so just project it directly
            socket.emit('select_bible', {
                verse: data.verse,
                content: data.content,
                parallel_content: data.parallel_content || ''
            });
        }
    });

    socket.on('update_bible_slide', (data) => {
        const path = window.location.pathname;
        const isBible = path.startsWith('/bible');

        // If we're on the bible page, update the preview area
        if (isBible) {
            const preview = document.getElementById('bible-preview-content');
            if (preview) {
                let contentHtml = `
                    <div style="text-align: center;">
                        <h2 style="color: var(--accent); margin-bottom: 15px;">${data.verse}</h2>
                        <div style="font-size: 1.2rem; line-height: 1.6; color: white;">${data.content}</div>
                `;

                if (data.parallel_content) {
                    contentHtml += `
                        <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid rgba(255,255,255,0.1); opacity: 0.85; font-style: italic;">
                            ${data.parallel_content}
                        </div>
                    `;
                }

                contentHtml += `</div>`;
                preview.innerHTML = contentHtml;

                // For the manager page, try to apply local styles to preview
                if (window.currentLibraryType === 'bible') {
                    if (typeof syncStyle === 'function') {
                        syncStyle('bh', 'bible-header');
                        syncStyle('bc', 'bible-content');
                        syncStyle('bp', 'bible-parallel');
                    }
                }
            }
        }
    });

    socket.on('new_bible_scraped', () => {
        // Obsolete since we emit select_bible directly, but kept for compatibility
    });

    // Global listener for PowerPoint remote commands
    socket.on('powerpoint_remote_cmd_relay', (data) => {
        const path = window.location.pathname;
        const isOutput = path.startsWith('/output');
        const isPowerpoint = path.startsWith('/powerpoint');
        const urlParams = new URLSearchParams(window.location.search);
        const isPopout = urlParams.get('popout') === 'true';
        const isEditor = path.startsWith('/editor') || path.startsWith('/media');

        // Do not interrupt the editor or media manager or popouts
        if (isEditor || isPopout) return;

        // If we get a remote press anywhere else in the app (Songs, Bible, Live, Birthdays, etc), immediately switch to PowerPoint
        if (!isOutput && !isPowerpoint) {
            window.location.href = `/powerpoint/?remote_cmd=resume`;
        }
    });

    // Media Sidebar Resizer
    const mediaResizer = document.getElementById('media-sidebar-resizer');
    const rightSidebar = document.getElementById('right-sidebar');
    if (mediaResizer && rightSidebar) {
        let isResizing = false;

        const savedWidth = localStorage.getItem('media-sidebar-width');
        if (savedWidth) {
            rightSidebar.style.width = savedWidth + 'px';
        }

        mediaResizer.addEventListener('mousedown', (e) => {
            isResizing = true;
            document.body.style.cursor = 'col-resize';
            mediaResizer.classList.add('resizing');
            rightSidebar.style.transition = 'none'; // Disable transition during drag
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;
            // Width is from right edge
            const newWidth = window.innerWidth - e.clientX;
            if (newWidth >= 250 && newWidth <= 600) {
                rightSidebar.style.width = newWidth + 'px';
                localStorage.setItem('media-sidebar-width', newWidth);
            }
        });

        document.addEventListener('mouseup', () => {
            if (isResizing) {
                isResizing = false;
                document.body.style.cursor = '';
                mediaResizer.classList.remove('resizing');
                rightSidebar.style.transition = '';
            }
        });
    }

    // --- Control and Manager Page Logic ---
    if (document.body.classList.contains('control-page') || document.body.classList.contains('manager-page')) {
        const songSearch = document.getElementById('song-search');
        const songList = document.getElementById('song-list');
        const lineupList = document.getElementById('service-lineup');
        const previewContent = document.getElementById('song-preview-content');
        const sectionBtns = document.getElementById('section-buttons');

        // --- Admin Mode Toggling & Persistence ---
        const manageToggle = document.getElementById('manage-songs-toggle');
        if (manageToggle) {
            const isAdmin = localStorage.getItem('library-admin-mode') === 'true';
            manageToggle.checked = isAdmin;

            manageToggle.addEventListener('change', () => {
                localStorage.setItem('library-admin-mode', manageToggle.checked);
                const q = songSearch ? songSearch.value : '';
                if (window.currentLibraryType === 'song') loadSongs(q);
                else if (window.currentLibraryType === 'live') loadLive(q);
                else if (window.currentLibraryType === 'live2') loadLive2(q);
            });
        }

        // --- Load Initial Data based on page ---
        const path = window.location.pathname;
        if (path.startsWith('/control') || path === '/') {
            window.currentLibraryType = 'song';
            loadSongs();
            loadService('song');
        } else if (path.startsWith('/bible')) {
            window.currentLibraryType = 'bible';
        } else if (path.startsWith('/birthdays')) {
            window.currentLibraryType = 'birthdays';
        } else if (path.startsWith('/announcements')) {
            window.currentLibraryType = 'announcements';
        } else if (path.startsWith('/live2')) {
            window.currentLibraryType = 'live2';
            loadLive2();
            loadService('live2');
        } else if (path.startsWith('/live')) {
            window.currentLibraryType = 'live';
            loadLive();
            loadService('live');
        }

        if (window.currentLibraryType) {

            // --- Panel Minimizing Logic ---
            const libPanel = document.getElementById('library-panel');
            const btnMinLib = document.getElementById('btn-minimize-library');
            const sidebarLibToggleItem = document.getElementById('sidebar-lib-toggle-item');
            const sidebarLibToggleBtn = document.getElementById('sidebar-lib-toggle');

            if (libPanel && btnMinLib) {
                if (sidebarLibToggleItem) sidebarLibToggleItem.style.display = 'block';

                const isMin = localStorage.getItem('library-minimized') === 'true';
                if (isMin) libPanel.classList.add('minimized');

                const toggleLib = () => {
                    libPanel.classList.toggle('minimized');
                    localStorage.setItem('library-minimized', libPanel.classList.contains('minimized'));
                };

                btnMinLib.addEventListener('click', toggleLib);
                if (sidebarLibToggleBtn) {
                    sidebarLibToggleBtn.addEventListener('click', (e) => {
                        e.preventDefault();
                        toggleLib();
                    });
                }
            }

            setTimeout(() => {
                const urlParams = new URLSearchParams(window.location.search);
                const projectLatest = urlParams.get('project_latest') === 'true';

                if (!projectLatest) {
                    clearOutputDisplay();
                }

                applyDefaultMedia();

                // Also clear manager's internal preview text
                const previews = [
                    'song-preview-content',
                    'bible-preview-content',
                    'birthday-preview-area',
                    'announcement-preview-area',
                    'bible-preview-area'
                ];
                previews.forEach(id => {
                    const el = document.getElementById(id);
                    if (el) el.innerHTML = '<p class="placeholder-text">Select an item to preview</p>';
                });
                const title = document.getElementById('current-song-title');
                if (title) title.innerText = 'Select an item';

                if (projectLatest && window.projectLatestBible) {
                    setTimeout(() => window.projectLatestBible(), 200);
                }
            }, 500);
        }

        // --- Media Library Logic ---
        let mediaCache = [];
        let activeFilters = {
            global: 'all'
        };

        const DELETE_MODE_KEY = 'jcob_media_delete_mode';
        let deleteModeEnabled = localStorage.getItem(DELETE_MODE_KEY) === 'true';

        // Set initial checkbox state
        const toggleDeleteMode = document.getElementById('toggle-delete-mode');
        const mediaAdminTools = document.getElementById('media-admin-tools');

        if (toggleDeleteMode) {
            toggleDeleteMode.checked = deleteModeEnabled;
            if (mediaAdminTools) mediaAdminTools.classList.toggle('hidden', !deleteModeEnabled);

            toggleDeleteMode.onchange = (e) => {
                deleteModeEnabled = e.target.checked;
                localStorage.setItem(DELETE_MODE_KEY, deleteModeEnabled);
                if (mediaAdminTools) mediaAdminTools.classList.toggle('hidden', !deleteModeEnabled);

                // Refresh the list to update button visibility
                loadMedia('global');
            };
        }

        function loadMedia(target = 'global', query = '') {
            const listId = 'global-media-list';
            const listEl = document.getElementById(listId);
            if (!listEl) return;

            const updateList = (items) => {
                renderMediaFilters(items, 'global');
                const activeCat = activeFilters['global'];
                const filtered = items.filter(m => {
                    const matchesQuery = m.name.toLowerCase().includes(query.toLowerCase());
                    let matchesCat = true;
                    if (activeCat !== 'all') {
                        if (activeCat === 'image' || activeCat === 'video') {
                            matchesCat = m.type === activeCat;
                        } else {
                            matchesCat = m.category === activeCat;
                        }
                    }
                    return matchesQuery && matchesCat;
                }).sort((a, b) => a.name.localeCompare(b.name));

                listEl.innerHTML = `
                    <li class="list-item" onclick="selectMedia(null, null, this, 'global')">
                        <div class="song-info"><strong>None (Transparent)</strong></div>
                    </li>
                ` + filtered.map(m => `
                    <li class="list-item" onclick="selectMedia('${m.url}', '${m.type}', this, 'global')">
                        <div class="song-info"><strong>${m.name}</strong></div>
                        <div class="actions">
                            <button class="btn-small pin-media-btn" 
                                    onclick="event.stopPropagation(); pinMediaToCurrentItem('${m.url}', '${m.type}')" 
                                    title="Link to current item (Song/Live)">📌</button>
                            <button class="btn-small default-media-btn" 
                                    onclick="event.stopPropagation(); setAsDefaultMedia('${m.url}', '${m.type}')" 
                                    title="Set as default for this section">★</button>
                            <button class="btn-small startup-media-btn ${deleteModeEnabled ? '' : 'hidden'}" 
                                    onclick="event.stopPropagation(); setAsStartupMedia('${m.url}', '${m.type}')" 
                                    title="Set as Startup Output Media">💻</button>
                            <button class="btn-small media-delete-btn ${deleteModeEnabled ? '' : 'hidden'}" style="background:#a52a2a"
                                    onclick="event.stopPropagation(); deleteMedia('${m.file_path || m.url}')" 
                                    title="Delete this file">🗑️</button>
                        </div>
                    </li>
                `).join('');
            };

            fetch('/api/videos/')
                .then(res => res.json())
                .then(mediaItems => {
                    mediaCache = mediaItems;
                    updateList(mediaItems);
                });
        }

        // Contextual Media Category Logic
        const PAGE_MEDIA_PREFS_KEY = 'jcob_page_media_prefs';
        function getPageContext() {
            const path = window.location.pathname;
            if (path === '/' || path.includes('/songs')) return 'songs';
            if (path.includes('/birthdays')) return 'birthdays';
            if (path.includes('/announcements')) return 'announcements';
            if (path.includes('/bible')) return 'bible';
            if (path.includes('/live2')) return 'live2';
            if (path.includes('/live')) return 'live';
            return 'other';
        }

        function getPreferredCategory() {
            const ctx = getPageContext();
            const prefs = JSON.parse(localStorage.getItem(PAGE_MEDIA_PREFS_KEY) || '{}');
            if (prefs[ctx]) return prefs[ctx];

            const defaults = {
                'songs': 'songs',
                'birthdays': 'birthday',
                'announcements': 'special',
                'bible': 'bible',
                'live': 'general',
                'live2': 'general'
            };
            return defaults[ctx] || 'all';
        }

        function clearOutputDisplay() {
            socket.emit('clear_output');
        }

        const LAST_MEDIA_KEY = 'jcob_last_media_by_context';
        function saveLastMediaForContext(url, type) {
            const ctx = getPageContext();
            const data = JSON.parse(localStorage.getItem(LAST_MEDIA_KEY) || '{}');
            data[ctx] = { url, type };
            localStorage.setItem(LAST_MEDIA_KEY, JSON.stringify(data));
        }

        function getLastMediaForContext() {
            const ctx = getPageContext();
            const data = JSON.parse(localStorage.getItem(LAST_MEDIA_KEY) || '{}');
            return data[ctx] || null;
        }

        function applyDefaultMedia() {
            const ctx = getPageContext();

            // 1. Check localStorage for last selection in this context
            const last = getLastMediaForContext();
            if (last) {
                selectMedia(last.url, last.type, null, 'global');
                return;
            }

            // 2. Fallback to category defaults
            const preferredCat = getPreferredCategory();
            if (preferredCat === 'all' || preferredCat === 'general') {
                selectMedia(null, null, null, 'global');
                return;
            }

            fetch('/api/videos/')
                .then(res => res.json())
                .then(items => {
                    const catItems = items.filter(m => m.category === preferredCat);
                    if (catItems.length > 0) {
                        const def = catItems[0];
                        selectMedia(def.url, def.type, null, 'global');
                    } else {
                        selectMedia(null, null, null, 'global');
                    }
                });
        }

        function savePreferredCategory(category) {
            const ctx = getPageContext();
            const prefs = JSON.parse(localStorage.getItem(PAGE_MEDIA_PREFS_KEY) || '{}');
            prefs[ctx] = category;
            localStorage.setItem(PAGE_MEDIA_PREFS_KEY, JSON.stringify(prefs));
        }

        function renderMediaFilters(items, target) {
            const filterContainer = document.getElementById(`${target}-category-filters`);
            if (!filterContainer || filterContainer.dataset.initialized === 'true') return;

            const categories = [...new Set(items.map(m => m.category))].filter(c => c !== 'general').sort();
            const filterTypes = ['all', ...categories, 'image', 'video'];

            // Auto-select based on page context
            const initialPref = getPreferredCategory();
            if (filterTypes.includes(initialPref)) {
                activeFilters[target] = initialPref;
            }

            filterContainer.innerHTML = filterTypes.map(cat => `
                <button class="filter-btn ${activeFilters[target] === cat ? 'active' : ''}" data-category="${cat}">
                    ${cat.charAt(0).toUpperCase() + cat.slice(1)}
                </button>
            `).join('');

            filterContainer.querySelectorAll('.filter-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    filterContainer.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    const newCat = btn.dataset.category;
                    activeFilters[target] = newCat;

                    // Remember this preference for this page
                    savePreferredCategory(newCat);

                    const searchId = target === 'global' ? 'global-media-search' : 'media-search';
                    const query = document.getElementById(searchId).value;

                    // Direct list refresh
                    const listId = target === 'global' ? 'global-media-list' : 'media-list';
                    const listEl = document.getElementById(listId);
                    const filtered = mediaCache.filter(m => {
                        const mq = m.name.toLowerCase().includes(query.toLowerCase());
                        let mc = true;
                        if (newCat !== 'all') {
                            if (newCat === 'image' || newCat === 'video') mc = m.type === newCat;
                            else mc = m.category === newCat;
                        }
                        return mq && mc;
                    }).sort((a, b) => a.name.localeCompare(b.name));

                    listEl.innerHTML = `
                        <li class="list-item" onclick="selectMedia(null, null, this, '${target}')">
                            <div class="song-info"><strong>None (Transparent)</strong></div>
                        </li>
                    ` + filtered.map(m => `
                        <li class="list-item" onclick="selectMedia('${m.url}', '${m.type}', this, '${target}')">
                            <div class="song-info"><strong>${m.name}</strong></div>
                            <div class="actions">
                                <button class="btn-small pin-media-btn" 
                                        onclick="event.stopPropagation(); pinMediaToCurrentItem('${m.url}', '${m.type}')" 
                                        title="Link to current item (Song/Live)">📌</button>
                                <button class="btn-small default-media-btn" 
                                        onclick="event.stopPropagation(); setAsDefaultMedia('${m.url}', '${m.type}')" 
                                        title="Set as default for this section">★</button>
                                <button class="btn-small startup-media-btn ${deleteModeEnabled ? '' : 'hidden'}" 
                                        onclick="event.stopPropagation(); setAsStartupMedia('${m.url}', '${m.type}')" 
                                        title="Set as Startup Output Media">💻</button>
                                <button class="btn-small media-delete-btn ${deleteModeEnabled ? '' : 'hidden'}" style="background:#a52a2a"
                                        onclick="event.stopPropagation(); deleteMedia('${m.file_path || m.url}')" 
                                        title="Delete this file">🗑️</button>
                            </div>
                        </li>
                    `).join('');
                });
            });
            filterContainer.dataset.initialized = 'true';
        }

        // Media Settings Persistence Helpers
        const MEDIA_SETTINGS_KEY = 'jcob_media_presets';
        function saveMediaSettings(url, settings) {
            if (!url) return;
            let allSettings = JSON.parse(localStorage.getItem(MEDIA_SETTINGS_KEY) || '{}');
            allSettings[url] = settings;
            localStorage.setItem(MEDIA_SETTINGS_KEY, JSON.stringify(allSettings));
        }

        function getMediaSettings(url) {
            if (!url) return null;
            let allSettings = JSON.parse(localStorage.getItem(MEDIA_SETTINGS_KEY) || '{}');
            return allSettings[url] || null;
        }

        // Global Media Search
        const globalMediaSearchEl = document.getElementById('global-media-search');
        if (globalMediaSearchEl) {
            globalMediaSearchEl.addEventListener('input', (e) => loadMedia('global', e.target.value));
        }

        window.selectMedia = (url, type, element, target = 'global') => {
            const item = mediaCache.find(m => m.url === url) || { url, type };
            const presets = getMediaSettings(url);
            let resizeMode, posX, posY;

            if (presets) {
                resizeMode = presets.resizeMode;
                posX = presets.posX;
                posY = presets.posY;

                // Sync UI inputs
                const rmEl = document.getElementById(`global-media-resize-mode`);
                const pxEl = document.getElementById(`global-media-pos-x`);
                const pyEl = document.getElementById(`global-media-pos-y`);
                if (rmEl) rmEl.value = resizeMode;
                if (pxEl) pxEl.value = posX;
                if (pyEl) pyEl.value = posY;
            } else {
                const rmEl = document.getElementById(`global-media-resize-mode`);
                const pxEl = document.getElementById(`global-media-pos-x`);
                const pyEl = document.getElementById(`global-media-pos-y`);
                resizeMode = rmEl ? rmEl.value : 'fill';
                posX = pxEl ? pxEl.value : 50;
                posY = pyEl ? pyEl.value : 50;
            }

            const payload = {
                width: '100%',
                height: '100%',
                interact: false,
                ...item,
                resizeMode,
                posX,
                posY
            };

            // If it's a proxy url, append the css (it's already parsed as 'custom_css' from backend)
            if (payload.custom_css && payload.url && payload.url.includes('/api/videos/proxy?url=')) {
                payload.url += `&css=${encodeURIComponent(payload.custom_css)}`;
            }

            socket.emit('video_update', payload);
            saveLastMediaForContext(url, type);

            // Highlight selected media in ALL lists to keep them in sync
            document.querySelectorAll(`.list-item`).forEach(el => {
                const onClick = el.getAttribute('onclick');
                if (onClick && onClick.includes('selectMedia')) {
                    if (url && onClick.includes(`'${url}'`)) el.classList.add('active');
                    else if (!url && onClick.includes('null')) el.classList.add('active');
                    else el.classList.remove('active');
                }
            });
        };

        const mediaControlsList = ['global-media-resize-mode', 'global-media-pos-x', 'global-media-pos-y'];
        mediaControlsList.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('input', () => {
                    const listId = 'global-media-list';
                    const activeMediaItem = document.querySelector(`#${listId} .list-item.active`);

                    if (activeMediaItem) {
                        const onclick = activeMediaItem.getAttribute('onclick');
                        const matches = onclick.match(/'([^']*)', '([^']*)'/);
                        const url = (matches && matches[1]) ? matches[1] : null;
                        const type = (matches && matches[2]) ? matches[2] : null;

                        const resizeMode = document.getElementById(`global-media-resize-mode`).value;
                        const posX = document.getElementById(`global-media-pos-x`).value;
                        const posY = document.getElementById(`global-media-pos-y`).value;

                        // Save persistent settings for this item
                        if (url) {
                            saveMediaSettings(url, { resizeMode, posX, posY });
                        }

                        socket.emit('video_update', { url, type, resizeMode, posX, posY });
                    }
                });
            }
        });

        // Right Media Sidebar Logic
        const globalMediaBtn = document.getElementById('btn-global-media');
        const rightSidebar = document.getElementById('right-sidebar');

        if (globalMediaBtn && rightSidebar) {
            globalMediaBtn.addEventListener('click', (e) => {
                e.preventDefault();
                rightSidebar.classList.toggle('hidden');
                if (!rightSidebar.classList.contains('hidden')) {
                    loadMedia('global');
                }
            });

            // Initial load for right sidebar if it's not starting hidden (or just load it anyway)
            loadMedia('global');
        }

        // --- Birthday Management ---
        const weeklyBirthdayList = document.getElementById('weekly-birthday-list');
        const allBirthdayList = document.getElementById('all-birthday-list');
        const birthdayHeaderInput = document.getElementById('birthday-header-input');

        function loadBirthdays() {
            // Load header
            fetch('/birthdays/settings')
                .then(res => res.json())
                .then(settings => {
                    const headerInput = document.getElementById('birthday-header-input');
                    if (headerInput) headerInput.value = settings.birthday_header || 'Birthday Celebrants';

                });

            // Load weekly
            fetch('/birthdays/current_week')
                .then(res => res.json())
                .then(celebrants => {
                    weeklyBirthdayList.innerHTML = celebrants.map(b => `
                        <li class="list-item">
                            <div><strong>${b.name}</strong> (${b.birth_month}/${b.birth_day})</div>
                            <div class="actions">
                                <input type="checkbox" ${b.is_present ? 'checked' : ''} onchange="togglePresent(${b.id}, this.checked)"> Present
                            </div>
                        </li>
                    `).join('');
                });

            // Load all
            loadAllBirthdays();
        }

        function loadAllBirthdays(query = '') {
            fetch(`/birthdays/data?q=${query}`)
                .then(res => res.json())
                .then(all => {
                    const list = document.getElementById('all-birthday-list');
                    if (list) {
                        list.innerHTML = all.map(b => `
                            <li class="list-item">
                                <div><strong>${b.name}</strong> (${b.birth_month}/${b.birth_day})</div>
                                <div class="actions">
                                    <button class="btn-small" onclick="editBirthday(${b.id})">✎</button>
                                    <button class="btn-small delete-btn" onclick="deleteBirthday(${b.id})">×</button>
                                </div>
                            </li>
                        `).join('');
                    }
                });
        }
        window.loadAllBirthdays = loadAllBirthdays;

        const bdaySearch = document.getElementById('birthday-search');
        if (bdaySearch) {
            bdaySearch.addEventListener('input', (e) => {
                loadAllBirthdays(e.target.value);
            });
        }

        window.saveBirthdayHeader = () => {
            fetch('/birthdays/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ birthday_header: birthdayHeaderInput.value })
            }).then(() => showAlert('Header saved!'));
        };


        // --- Announcement Management ---
        const announcementList = document.getElementById('announcement-list');
        const announcementSearch = document.getElementById('announcement-search');

        if (announcementSearch) {
            announcementSearch.addEventListener('input', (e) => {
                loadAnnouncements(e.target.value);
            });
        }

        function loadAnnouncements(query = '') {
            fetch('/announcements/data')
                .then(res => res.json())
                .then(announcements => {
                    const list = document.getElementById('announcement-list');
                    if (list) {
                        const qLower = query.toLowerCase();
                        const filtered = announcements.filter(a =>
                            a.title.toLowerCase().includes(qLower) ||
                            (a.header && a.header.toLowerCase().includes(qLower)) ||
                            (a.content && a.content.toLowerCase().includes(qLower))
                        );

                        list.innerHTML = filtered.map(a => `
                            <li class="list-item" data-id="${a.id}" onclick="previewAnnouncement(${a.id})">
                                <div class="song-info"><strong>${a.title}</strong></div>
                                <div class="actions">
                                    <button class="btn-small pin-media-btn" 
                                            onclick="event.stopPropagation(); window.currentItemType='announcements'; currentSongId=${a.id}; document.getElementById('btn-global-media')?.click();" 
                                            title="Link Media">📌</button>
                                    ${a.media_url ? `<button class="btn-small clear-media-btn" 
                                            onclick="event.stopPropagation(); clearAnnouncementMedia(${a.id})" 
                                            title="Clear Linked Media" style="color: #ff5252; background: rgba(255, 82, 82, 0.1);">🚫</button>` : ''}
                                    <button class="btn-small" onclick="event.stopPropagation(); editAnnouncement(${a.id})">✎</button>
                                    <button class="btn-small delete-btn" onclick="event.stopPropagation(); deleteAnnouncement(${a.id})">×</button>
                                </div>
                            </li>
                        `).join('');
                    }
                });
        }

        window.previewAnnouncement = (id, autoProject = true) => {
            fetch('/announcements/data')
                .then(res => res.json())
                .then(list => {
                    const a = list.find(item => item.id == id);
                    if (a) {
                        window.currentSongId = a.id;
                        window.currentItemType = 'announcements';

                        const previewContent = document.getElementById('announcement-preview-content');
                        const projectBtn = document.getElementById('btn-project-announcement');

                        // Highlight list item
                        document.querySelectorAll('#announcement-list .list-item').forEach(el => el.classList.remove('active'));
                        const activeItem = document.querySelector(`#announcement-list .list-item[data-id="${id}"]`);
                        if (activeItem) activeItem.classList.add('active');

                        if (previewContent && projectBtn) {
                            previewContent.innerHTML = `
                                <h3>${a.header || ''}</h3>
                                <div id="ann-prev-txt">${a.content}</div>
                            `;
                            projectBtn.classList.remove('hidden');
                            projectBtn.onclick = () => showAnnouncementOnOutput(a);
                        }

                        // AUTO-APPLY MEDIA
                        if (a.media_url) {
                            selectMedia(a.media_url, a.media_type, null, 'global');
                        }

                        // AUTO-APPLY CUSTOM STYLES (Individual Announcement)
                        if (a.style_json) {
                            try {
                                const customStyles = JSON.parse(a.style_json);
                                if (customStyles.header && customStyles.content) {
                                    socket.emit('style_update', { target: 'announcement-header', styles: customStyles.header });
                                    socket.emit('style_update', { target: 'announcement-content', styles: customStyles.content });
                                    setStyleForm(customStyles.header, 'ah-');
                                    setStyleForm(customStyles.content, 'ac-');
                                } else {
                                    // Handle legacy single-object format
                                    socket.emit('style_update', { target: 'announcement-content', styles: customStyles });
                                    setStyleForm(customStyles, 'ac-');
                                }
                            } catch (e) { console.error("Error applying announcement styles:", e); }
                        } else {
                            // FALLBACK TO GLOBAL
                            if (window.globalStyleDefaults['announcement-header']) {
                                setStyleForm(window.globalStyleDefaults['announcement-header'], 'ah-');
                                socket.emit('style_update', { target: 'announcement-header', styles: window.globalStyleDefaults['announcement-header'] });
                            }
                            if (window.globalStyleDefaults['announcement-content']) {
                                setStyleForm(window.globalStyleDefaults['announcement-content'], 'ac-');
                                socket.emit('style_update', { target: 'announcement-content', styles: window.globalStyleDefaults['announcement-content'] });
                            }
                        }

                        // AUTO-PROJECT
                        if (autoProject) {
                            showAnnouncementOnOutput(a);
                        }
                    }
                });
        };

        window.showAnnouncementOnOutput = (a) => {
            // First, emit CURRENT UI styles to ensure live look is captured
            let headerStyles = getStyleObject('ah-');
            let contentStyles = getStyleObject('ac-');

            if (headerStyles) socket.emit('style_update', { target: 'announcement-header', styles: headerStyles });
            if (contentStyles) socket.emit('style_update', { target: 'announcement-content', styles: contentStyles });

            socket.emit('select_announcement', {
                title: a.header || '', // Passed as title to match output node
                content: a.content
            });
        };

        window.togglePresent = (id, checked) => {
            fetch(`/birthdays/toggle_present/${id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ is_present: checked })
            }).then(() => {
                // Optionally reload or reflect UI state
            });
        };



        // --- Bible Management ---
        window.loadBibles = (query = '') => {
            fetch('/bible/data')
                .then(res => res.json())
                .then(bibles => {
                    const list = document.getElementById('bible-list');
                    if (!list) return;

                    // Filter client side
                    const qLower = query.toLowerCase();
                    const filtered = bibles.filter(b => b.verse.toLowerCase().includes(qLower) || b.content.toLowerCase().includes(qLower));

                    list.innerHTML = filtered.map(b => `
                        <li class="list-item" data-id="${b.id}" onclick="previewBible(${b.id})">
                            <div class="song-info">
                                <strong>${b.verse}</strong> <small>(${b.translation || 'Unknown'})</small>
                            </div>
                            <div class="actions">
                                <button class="btn-small project-btn" onclick="event.stopPropagation(); projectBible(${b.id})" title="Project Immediately">🚀</button>
                                <button class="btn-small delete-btn" onclick="event.stopPropagation(); deleteBible(${b.id})">×</button>
                            </div>
                        </li>
                    `).join('');
                });
        };

        window.projectBible = (id) => {
            fetch('/bible/data')
                .then(res => res.json())
                .then(list => {
                    const b = list.find(item => item.id == id);
                    if (b) {
                        socket.emit('select_bible', {
                            verse: `${b.verse} ${b.translation ? '(' + b.translation + ')' : ''}`,
                            content: b.content
                        });
                        // showAlert removed as per request
                    }
                });
        };

        window.previewBible = (id) => {
            fetch('/bible/data')
                .then(res => res.json())
                .then(list => {
                    const b = list.find(item => item.id == id);
                    if (b) {
                        const previewContent = document.getElementById('bible-preview-content');
                        const projectBtn = document.getElementById('btn-project-bible');

                        document.querySelectorAll('#bible-list .list-item').forEach(el => el.classList.remove('active'));
                        const activeItem = document.querySelector(`#bible-list .list-item[data-id="${id}"]`);
                        if (activeItem) activeItem.classList.add('active');

                        if (previewContent && projectBtn) {
                            previewContent.innerHTML = `
                                <h3>${b.verse} ${b.translation ? '(' + b.translation + ')' : ''}</h3>
                                <p>${b.content}</p>
                            `;
                            projectBtn.classList.remove('hidden');
                            projectBtn.onclick = () => {
                                socket.emit('select_bible', {
                                    verse: `${b.verse} ${b.translation ? '(' + b.translation + ')' : ''}`,
                                    content: b.content
                                });
                            };
                        }
                    }
                });
        };

        const bibleSearch = document.getElementById('bible-search');
        if (bibleSearch) {
            bibleSearch.addEventListener('input', (e) => loadBibles(e.target.value));
        }

        const btnShowBirthdays = document.getElementById('btn-show-birthdays');
        if (btnShowBirthdays) {
            btnShowBirthdays.onclick = () => {
                fetch('/birthdays/current_week')
                    .then(res => res.json())
                    .then(celebrants => {
                        const headerInput = document.getElementById('birthday-header-input');
                        socket.emit('select_birthday', {
                            header: (headerInput && headerInput.value.trim() !== '') ? headerInput.value : 'Birthday Celebrants',
                            celebrants: celebrants.filter(b => b.is_present)
                        });
                    });
            };
        }

        // Search songs
        if (songSearch) {
            songSearch.addEventListener('input', (e) => loadSongs(e.target.value));
        }

        const liveSearch = document.getElementById('live-search');
        if (liveSearch) {
            liveSearch.addEventListener('input', (e) => loadLive(e.target.value));
        }

        const live2Search = document.getElementById('live2-search');
        if (live2Search) {
            live2Search.addEventListener('input', (e) => loadLive2(e.target.value));
        }

        if (location.pathname.startsWith('/birthdays')) {
            loadBirthdays();
        } else if (location.pathname.startsWith('/announcements')) {
            loadAnnouncements();
        }

        function loadSongs(query = '') {
            const isAdminMode = document.getElementById('manage-songs-toggle')?.checked;
            fetch(`/songs/search?q=${query}`)
                .then(res => res.json())
                .then(songs => {
                    if (songList) songList.innerHTML = songs.map(s => `
                        <li class="list-item" onclick="previewSong(${s.id})">
                            <div class="song-info">
                                <strong>${s.title}</strong><br>
                                <small>${s.author || 'Unknown'}</small>
                            </div>
                            <div class="actions">
                                ${isAdminMode ? `
                                    <button class="btn-small edit-btn" onclick="event.stopPropagation(); editSong(${s.id})">✎</button>
                                    <button class="btn-small delete-btn" onclick="deleteSong(event, ${s.id})">×</button>
                                ` : ''}
                                <button class="btn-small add-to-lineup-btn" onclick="event.stopPropagation(); addToLineup('song', ${s.id})">+</button>
                            </div>
                        </li>
                    `).join('');
                });
        }

        function loadLive(query = '') {
            const isAdminMode = document.getElementById('manage-songs-toggle')?.checked;
            fetch(`/live/search?q=${query}`)
                .then(res => res.json())
                .then(lives => {
                    const lList = document.getElementById('live-list');
                    if (lList) lList.innerHTML = lives.map(l => `
                        <li class="list-item" onclick="previewLive(${l.id})">
                            <div class="song-info">
                                <strong>${l.title}</strong><br>
                                <small>${l.author || 'Unknown'}</small>
                            </div>
                            <div class="actions">
                                ${isAdminMode ? `
                                    <button class="btn-small edit-btn" onclick="event.stopPropagation(); editLive(${l.id})">✎</button>
                                    <button class="btn-small delete-btn" onclick="deleteLive(event, ${l.id})">×</button>
                                ` : ''}
                                <button class="btn-small add-to-lineup-btn" onclick="event.stopPropagation(); addToLineup('live', ${l.id})">+</button>
                            </div>
                        </li>
                    `).join('');
                });
        }

        function loadLive2(query = '') {
            const isAdminMode = document.getElementById('manage-songs-toggle')?.checked;
            fetch(`/live2/search?q=${query}`)
                .then(res => res.json())
                .then(lives => {
                    const lList = document.getElementById('live2-list');
                    if (lList) lList.innerHTML = lives.map(l => `
                        <li class="list-item" onclick="previewLive2(${l.id})">
                            <div class="song-info">
                                <strong>${l.title}</strong><br>
                                <small>${l.author || 'Unknown'}</small>
                            </div>
                            <div class="actions">
                                ${isAdminMode ? `
                                    <button class="btn-small edit-btn" onclick="event.stopPropagation(); editLive2(${l.id})">✎</button>
                                    <button class="btn-small delete-btn" onclick="deleteLive2(event, ${l.id})">×</button>
                                ` : ''}
                                <button class="btn-small add-to-lineup-btn" onclick="event.stopPropagation(); addToLineup('live2', ${l.id})">+</button>
                            </div>
                        </li>
                    `).join('');
                });
        }

        // --- Settings Logic ---
        const btnSettings = document.getElementById('btn-settings');
        const settingsPanel = document.getElementById('settings-panel');
        const themeSelect = document.getElementById('theme-select');

        if (btnSettings && settingsPanel) {
            btnSettings.addEventListener('click', () => settingsPanel.classList.toggle('hidden'));
        }

        if (themeSelect) {
            // Theme switching
            themeSelect.addEventListener('change', (e) => {
                const theme = e.target.value;
                document.body.classList.remove('midnight', 'slate');
                if (theme !== 'default') document.body.classList.add(theme);
                localStorage.setItem('controller-theme', theme);
            });

            // Load theme from preference
            const savedTheme = localStorage.getItem('controller-theme');
            if (savedTheme) {
                themeSelect.value = savedTheme;
                themeSelect.dispatchEvent(new Event('change'));
            }
        }

        // --- Style Helpers ---
        function getStyleObject(prefix = '') {
            const fontFamilyEl = document.getElementById(prefix + 'font-family');
            const colorEl = document.getElementById(prefix + 'font-color');
            if (!fontFamilyEl && !colorEl) return null;

            const fontSizeEl = document.getElementById(prefix + 'font-size');
            const embedSizeEl = document.getElementById(prefix + 'embed-size');
            const xPosEl = document.getElementById(prefix + 'x-pos');
            const yPosEl = document.getElementById(prefix + 'y-pos');
            const shadowIntensityEl = document.getElementById(prefix + 'shadow-intensity');
            const textTransformEl = document.getElementById(prefix + 'text-transform');
            const textAlignEl = document.getElementById(prefix + 'text-align');
            const verticalAlignEl = document.getElementById(prefix + 'vertical-align');
            const fontBoldEl = document.getElementById(prefix + 'font-bold');
            const fontItalicEl = document.getElementById(prefix + 'font-italic');
            const transStyleEl = document.getElementById(prefix + 'transition-style');
            const transSpeedEl = document.getElementById(prefix + 'transition-speed');
            const borderColorEl = document.getElementById(prefix + 'border-color');
            const borderSizeEl = document.getElementById(prefix + 'border-size');
            const borderToggleEl = document.getElementById(prefix + 'font-border');

            return {
                fontFamily: fontFamilyEl ? fontFamilyEl.value : null,
                fontSize: fontSizeEl ? fontSizeEl.value + 'px' : '90px',
                "--embed-size": embedSizeEl ? embedSizeEl.value + 'px' : '500px',
                "--x-pos": xPosEl ? xPosEl.value + 'px' : '0px',
                "--y-pos": yPosEl ? yPosEl.value + 'px' : '0px',
                color: colorEl ? colorEl.value : '#ffffff',
                textShadow: shadowIntensityEl ? `0px 0px ${shadowIntensityEl.value}px rgba(0,0,0,0.9)` : 'none',
                textTransform: textTransformEl ? textTransformEl.value : 'none',
                textAlign: textAlignEl ? textAlignEl.value : 'center',
                alignSelf: verticalAlignEl ? verticalAlignEl.value : 'center',
                fontWeight: (fontBoldEl && fontBoldEl.checked) ? 'bold' : 'normal',
                fontStyle: (fontItalicEl && fontItalicEl.checked) ? 'italic' : 'normal',
                transitionStyle: transStyleEl ? transStyleEl.value : 'fade',
                transitionSpeed: transSpeedEl ? transSpeedEl.value : '0.5',
                webkitTextStroke: (borderToggleEl && borderToggleEl.checked) ? 
                    ((borderColorEl && borderSizeEl && borderSizeEl.value > 0) ? `${borderSizeEl.value}px ${borderColorEl.value}` : 'inherit') : 
                    '0px transparent'
            };
        }

        function setStyleForm(styles, prefix = '') {
            if (styles.fontFamily) { const el = document.getElementById(prefix + 'font-family'); if (el) el.value = styles.fontFamily; }
            if (styles.fontSize) {
                const val = styles.fontSize.replace('px', '');
                const elNum = document.getElementById(prefix + 'font-size');
                const elSlider = document.getElementById(prefix + 'font-size-slider');
                if (elNum) elNum.value = val;
                if (elSlider) elSlider.value = val;
            }
            if (styles['--embed-size']) {
                const val = (styles['--embed-size'] || "500").replace('px', '');
                const elNum = document.getElementById(prefix + 'embed-size');
                const elSlider = document.getElementById(prefix + 'embed-size-slider');
                if (elNum) elNum.value = val;
                if (elSlider) elSlider.value = val;
            }
            if (styles['--x-pos']) {
                const val = styles['--x-pos'].replace('px', '').replace('%', '');
                const elNum = document.getElementById(prefix + 'x-pos');
                const elSlider = document.getElementById(prefix + 'x-pos-slider');
                if (elNum) elNum.value = val;
                if (elSlider) elSlider.value = val;
            }
            if (styles['--y-pos']) {
                const val = styles['--y-pos'].replace('px', '').replace('%', '');
                const elNum = document.getElementById(prefix + 'y-pos');
                const elSlider = document.getElementById(prefix + 'y-pos-slider');
                if (elNum) elNum.value = val;
                if (elSlider) elSlider.value = val;
            }
            if (styles.color) { const el = document.getElementById(prefix + 'font-color'); if (el) el.value = styles.color; }
            if (styles.textShadow) {
                const match = styles.textShadow.match(/0px 0px (\d+)px/);
                if (match) {
                    const val = match[1];
                    const elSlider = document.getElementById(prefix + 'shadow-intensity');
                    const elNum = document.getElementById(prefix + 'shadow-intensity-num');
                    if (elSlider) elSlider.value = val;
                    if (elNum) elNum.value = val;
                }
            }
            if (styles.textTransform) { const el = document.getElementById(prefix + 'text-transform'); if (el) el.value = styles.textTransform; }
            if (styles.webkitTextStroke) {
                const match = styles.webkitTextStroke.match(/(\d+)px (#[0-9a-fA-F]+|transparent)/);
                const toggle = document.getElementById(prefix + 'font-border');
                if (match) {
                    const size = parseInt(match[1]);
                    const color = match[2];
                    const elColor = document.getElementById(prefix + 'border-color');
                    const elSize = document.getElementById(prefix + 'border-size');
                    const elSizeNum = document.getElementById(prefix + 'border-size-num');
                    
                    if (elColor && color !== 'transparent') elColor.value = color;
                    if (elSize) elSize.value = size;
                    if (elSizeNum) elSizeNum.value = size;
                    
                    if (toggle) {
                        // OFF if size is 0 OR color is transparent
                        toggle.checked = (size > 0 && color !== 'transparent');
                    }
                } else if (styles.webkitTextStroke === 'inherit') {
                    if (toggle) toggle.checked = true; // Use checked for inherit (match parent)
                    const elSize = document.getElementById(prefix + 'border-size');
                    if (elSize) elSize.value = 0;
                    const elSizeNum = document.getElementById(prefix + 'border-size-num');
                    if (elSizeNum) elSizeNum.value = 0;
                }
            } else {
                const toggle = document.getElementById(prefix + 'font-border');
                if (toggle) toggle.checked = false;
            }
            if (styles.textAlign) { const el = document.getElementById(prefix + 'text-align'); if (el) el.value = styles.textAlign; }
            if (styles.alignSelf) { const el = document.getElementById(prefix + 'vertical-align'); if (el) el.value = styles.alignSelf; }
            if (styles.fontWeight) { const el = document.getElementById(prefix + 'font-bold'); if (el) el.checked = (styles.fontWeight === 'bold'); }
            if (styles.fontStyle) { const el = document.getElementById(prefix + 'font-italic'); if (el) el.checked = (styles.fontStyle === 'italic'); }
            if (styles.transitionStyle) { const el = document.getElementById(prefix + 'transition-style'); if (el) el.value = styles.transitionStyle; }
            if (styles.transitionSpeed) {
                const val = styles.transitionSpeed;
                const elNum = document.getElementById(prefix + 'transition-speed');
                const elSlider = document.getElementById(prefix + 'transition-speed-slider');
                if (elNum) elNum.value = val;
                if (elSlider) elSlider.value = val;
            }
        }

        function bindStyleSettings(targetStr, prefix = '') {
            const params = ['font-family', 'font-size', 'embed-size', 'x-pos', 'y-pos', 'font-color', 'shadow-intensity', 'text-transform', 'text-align', 'vertical-align', 'font-bold', 'font-italic', 'transition-style', 'transition-speed', 'border-color', 'border-size', 'font-border'];

            // Sync Sliders and Numbers
            syncInputs(prefix + 'font-size-slider', prefix + 'font-size');
            syncInputs(prefix + 'embed-size-slider', prefix + 'embed-size');
            syncInputs(prefix + 'x-pos-slider', prefix + 'x-pos');
            syncInputs(prefix + 'y-pos-slider', prefix + 'y-pos');
            syncInputs(prefix + 'shadow-intensity', prefix + 'shadow-intensity-num');
            syncInputs(prefix + 'transition-speed-slider', prefix + 'transition-speed');
            syncInputs(prefix + 'border-size', prefix + 'border-size-num');

            // Attach input listeners
            params.forEach(param => {
                const el = document.getElementById(prefix + param);
                if (el) {
                    const notify = () => {
                        const styles = getStyleObject(prefix);
                        if (styles) socket.emit('style_update', { target: targetStr, styles });
                    };
                    el.addEventListener('input', notify);
                    el.addEventListener('change', notify);
                }
            });

            // Initial sync
            const initialStyles = getStyleObject(prefix);
            if (initialStyles) socket.emit('style_update', { target: targetStr, styles: initialStyles });
        }

        // Store global styles for fallback
        window.globalStyleDefaults = {};

        // Helper for group settings
        const saveSettingsGroup = (targetConfigs) => {
            const settingsObject = {};
            targetConfigs.forEach((conf) => {
                const styles = getStyleObject(conf.prefix);
                if (styles) {
                    settingsObject[conf.target] = JSON.stringify(styles);
                    // Update fallback memory
                    window.globalStyleDefaults[conf.target] = styles;
                }
            });

            // ASK USER IF THEY WANT TO OVERWRITE PINS
            const overwrite = confirm("Do you want to apply these global settings to ALL items (this will overwrite any individual pins you've saved)?");
            if (overwrite) settingsObject.overwrite_pins = true;

            fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settingsObject)
            }).then(() => {
                showAlert('Settings Saved!');
                // Emit update to all clients to reflect global changes
                targetConfigs.forEach(conf => {
                    const styles = getStyleObject(conf.prefix);
                    if (styles) socket.emit('style_update', { target: conf.target, styles: styles });
                });
            });
        };

        // Load globally from API on boot
        fetch('/api/settings')
            .then(res => res.json())
            .then(data => {
                const path = window.location.pathname;
                console.log("Loading settings for path:", path);

                // Keyboard Shortcuts Init
                if (data.keyboard_mappings) {
                    try {
                        const mappings = JSON.parse(data.keyboard_mappings);
                        console.log("Keyboard mappings loaded:", mappings);

                        document.addEventListener('keydown', (e) => {
                            // Ignore if user is typing in an input/textarea
                            if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
                            // Ignore if any modifier keys are pressed (Cmd/Ctrl/Alt)
                            if (e.metaKey || e.ctrlKey || e.altKey) return;

                            const key = e.key.toUpperCase();
                            // Find tag mapped to this key
                            const tag = Object.keys(mappings).find(t => mappings[t] === key);

                            if (tag) {
                                // Find the button or section with this tag
                                const btn = Array.from(document.querySelectorAll('.sec-btn')).find(b => b.dataset.tag === tag);
                                if (btn) {
                                    e.preventDefault();
                                    console.log("Keyboard shortcut triggered for tag:", tag);
                                    // Optimization: call emitSection directly or click the button
                                    btn.click();
                                }
                            }
                        });
                    } catch (e) { console.error("Error loading keyboard mappings:", e); }
                }

                let target = null;
                let prefixes = [];

                if (path.startsWith('/control') || path === '/') {
                    window.currentLibraryType = 'song';
                    target = 'lyrics';
                    prefixes = [{ key: 'lyrics', p: '' }, { key: 'lyrics-emp', p: 'emp-' }];
                }
                else if (path.startsWith('/live2')) {
                    window.currentLibraryType = 'live2';
                    target = 'live2-lyrics';
                    prefixes = [{ key: 'live2-lyrics', p: '' }, { key: 'live2-emp', p: 'emp-' }];
                }
                else if (path.startsWith('/live')) {
                    window.currentLibraryType = 'live';
                    target = 'live-lyrics';
                    prefixes = [{ key: 'live-lyrics', p: '' }, { key: 'live-emp', p: 'emp-' }];
                }
                else if (path.startsWith('/birthdays')) {
                    prefixes = [
                        { key: 'birthday-header', p: 'bh-' },
                        { key: 'birthday-content', p: 'bc-' }
                    ];
                }
                else if (path.startsWith('/announcements')) {
                    prefixes = [
                        { key: 'announcement-header', p: 'ah-' },
                        { key: 'announcement-content', p: 'ac-' }
                    ];
                }
                else if (path.startsWith('/bible')) {
                    prefixes = [
                        { key: 'bible-header', p: 'bh-' },
                        { key: 'bible-content', p: 'bc-' },
                        { key: 'bible-parallel', p: 'bp-' }
                    ];
                }
                else if (path.startsWith('/output')) {
                    // STORE ALL GLOBAL SETTINGS FOR FALLBACK
                    window.outputSettings = data;

                    // Apply ALL styles to ALL targets on the output page immediately
                    const fullTargetMap = {
                        'lyrics': 'lyrics-text',
                        'live-lyrics': 'live-text',
                        'live2-lyrics': 'live2-text',
                        'birthday-header': 'birthday-header',
                        'birthday-content': 'birthday-list',
                        'announcement-header': 'announcement-title',
                        'announcement-content': 'announcement-content',
                        'bible-header': 'bible-reference',
                        'bible-content': 'bible-text-content',
                        'bible-parallel': 'bible-parallel-content'
                    };

                    Object.keys(data).forEach(key => {
                        if (key.endsWith('-emp')) {
                            try {
                                const styles = JSON.parse(data[key]);
                                let ruleId = key + '-style';
                                let styleEl = document.getElementById(ruleId);
                                if (!styleEl) {
                                    styleEl = document.createElement('style');
                                    styleEl.id = ruleId;
                                    document.head.appendChild(styleEl);
                                }

                                let containerSelectors = [];
                                if (key === 'lyrics-emp') containerSelectors = ['#lyrics-text', '#song-preview-content'];
                                if (key === 'live-emp') containerSelectors = ['#live-text', '#song-preview-content'];
                                if (key === 'live2-emp') containerSelectors = ['#live2-text', '#song-preview-content'];

                                if (containerSelectors.length > 0) {
                                    const finalSelectors = containerSelectors.map(s => s + ' emp').join(', ');
                                    styleEl.innerHTML = `
                                        ${finalSelectors} {
                                            font-family: ${styles.fontFamily || 'inherit'};
                                            font-size: ${styles.fontSize || '1em'};
                                            color: ${styles.color || 'inherit'};
                                            text-shadow: ${styles.textShadow || 'none'};
                                            font-weight: ${styles.fontWeight || 'normal'};
                                            font-style: ${styles.fontStyle || 'normal'};
                                            text-transform: ${styles.textTransform || 'none'};
                                        }
                                    `;
                                }
                            } catch (e) { }
                            return;
                        }

                        const targetId = fullTargetMap[key];
                        if (targetId && data[key]) {
                            try {
                                const styles = JSON.parse(data[key]);
                                const el = document.getElementById(targetId);
                                if (el) {
                                    const stylesToApply = { ...styles };
                                    // Handle vertical align container logic
                                    if (key.includes('birthday') || key.includes('announcement') || key.includes('bible')) {
                                        const containerId = key.includes('birthday') ? 'birthday-output' :
                                            key.includes('announcement') ? 'announcement-output' : 'bible-output';
                                        const container = document.getElementById(containerId);
                                        if (container && stylesToApply.alignSelf) {
                                            container.style.alignSelf = stylesToApply.alignSelf;
                                            delete stylesToApply.alignSelf;
                                        }
                                    }
                                    applyStylesToElement(el, stylesToApply);
                                }
                            } catch (e) { console.error("Error applying init style:", key, e); }
                        }
                    });
                }

                // Apply and Bind
                prefixes.forEach(conf => {
                    if (data[conf.key]) {
                        try {
                            const styles = JSON.parse(data[conf.key]);
                            window.globalStyleDefaults[conf.key] = styles;
                            setStyleForm(styles, conf.p);
                        } catch (e) { console.error("Error parsing settings for", conf.key, e); }
                    }
                    bindStyleSettings(conf.key, conf.p);

                });

                // Global Save Button Mapping
                const btnSave = document.getElementById('btn-save-settings');
                if (btnSave && target) {
                    btnSave.onclick = () => {
                        let groups = [{ target: target, prefix: '' }];
                        if (target === 'lyrics') groups.push({ target: 'lyrics-emp', prefix: 'emp-' });
                        if (target === 'live-lyrics') groups.push({ target: 'live-emp', prefix: 'emp-' });
                        if (target === 'live2-lyrics') groups.push({ target: 'live2-emp', prefix: 'emp-' });
                        saveSettingsGroup(groups);
                    };
                }

                // Specific Save Buttons
                const btnSaveBirthday = document.getElementById('btn-save-birthday-settings');
                if (btnSaveBirthday) {
                    btnSaveBirthday.onclick = () => saveSettingsGroup([
                        { target: 'birthday-header', prefix: 'bh-' },
                        { target: 'birthday-content', prefix: 'bc-' }
                    ]);
                }
                const btnSaveAnnouncement = document.getElementById('btn-save-announcement-settings');
                if (btnSaveAnnouncement) {
                    btnSaveAnnouncement.onclick = () => saveSettingsGroup([
                        { target: 'announcement-header', prefix: 'ah-' },
                        { target: 'announcement-content', prefix: 'ac-' }
                    ]);
                }
                const btnSaveBible = document.getElementById('btn-save-bible-settings');
                if (btnSaveBible) {
                    btnSaveBible.onclick = () => saveSettingsGroup([
                        { target: 'bible-header', prefix: 'bh-' },
                        { target: 'bible-content', prefix: 'bc-' },
                        { target: 'bible-parallel', prefix: 'bp-' }
                    ]);
                }
            });

        function loadService(type = 'song') {
            fetch(`/services/active?type=${type}`)
                .then(res => res.json())
                .then(service => {
                    window.currentServiceId = service.id;
                    document.getElementById('active-service-name').innerText = service.name;
                    renderLineup(service.items);
                });
        }

        function renderLineup(items) {
            lineupList.innerHTML = items.map(item => `
                <li class="list-item" data-id="${item.id}" onclick="selectServiceItem('${item.type}', ${item.item_id}, this)">
                    <div>${item.title}</div>
                    <button class="btn-small remove-btn" onclick="event.stopPropagation(); removeItemFromService(${item.id})">×</button>
                </li>
            `).join('');

            // Reorder logic
            new Sortable(lineupList, {
                animation: 150,
                onEnd: () => {
                    const order = Array.from(lineupList.children).map((el, index) => ({
                        id: el.dataset.id,
                        position: index + 1
                    }));
                    fetch('/services/reorder', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(order)
                    });
                }
            });
        }

        window.removeItemFromService = (itemId) => {
            fetch(`/services/remove_item/${itemId}`, { method: 'POST' })
                .then(() => loadService(window.currentLibraryType || 'song'));
        };

        window.addToLineup = (type, itemId) => {
            fetch('/services/add_item', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    service_id: window.currentServiceId,
                    item_type: type,
                    item_id: itemId
                })
            }).then(() => loadService(window.currentLibraryType || 'song'));
        };

        window.previewSong = (songId, auto = false) => { window.currentItemType = 'song'; previewItem(`/songs/${songId}`, auto); };
        window.previewLive = (liveId, auto = false) => { window.currentItemType = 'live'; previewItem(`/live/${liveId}`, auto); };
        window.previewLive2 = (live2Id, auto = false) => { window.currentItemType = 'live2'; previewItem(`/live2/${live2Id}`, auto); };

        function previewItem(url, autoProject = false) {
            fetch(url)
                .then(res => res.json())
                .then(item => {
                    window.currentSongId = item.id;
                    document.getElementById('current-song-title').innerText = item.title;

                    const tagColors = [
                        '#3f51b5', '#4caf50', '#ff9800', '#9c27b0', '#e91e63',
                        '#0097a7', '#795548', '#ef5350', '#673ab7', '#2e7d32',
                        '#c62828', '#1565c0', '#4527a0', '#ad1457', '#00b0ff'
                    ];

                    // Group by Major Tag (V1.1 -> V1)
                    const majorTags = [];
                    item.sections.forEach(sec => {
                        const major = sec.tag.split('.')[0];
                        if (!majorTags.includes(major)) majorTags.push(major);
                    });

                    // Render Section Buttons
                    sectionBtns.innerHTML = item.sections.map((sec) => {
                        const major = sec.tag.split('.')[0];
                        const colorIdx = majorTags.indexOf(major);
                        const color = tagColors[colorIdx % tagColors.length];
                        return `
                        <button class="sec-btn" 
                                style="border-left: 5px solid ${color}; --active-color: ${color};"
                                data-tag="${sec.tag}" 
                                data-content="${sec.content.replace(/"/g, '&quot;').replace(/\n/g, '&#10;')}" 
                                onclick="emitSection('${sec.tag}', this.dataset.content)">${sec.tag}</button>
                    `}).join('');

                    // Render Preview Lyrics
                    previewContent.innerHTML = item.sections.map((sec) => {
                        const major = sec.tag.split('.')[0];
                        const colorIdx = majorTags.indexOf(major);
                        const color = tagColors[colorIdx % tagColors.length];
                        return `
                        <div class="song-section" id="sec-${sec.tag}" 
                             style="border-left: 5px solid ${color};"
                             data-content="${sec.content.replace(/"/g, '&quot;').replace(/\n/g, '&#10;')}" 
                             onclick="emitSection('${sec.tag}', this.dataset.content)">
                            <div class="sec-tag" style="color: ${color};">${sec.tag}</div>
                            <div class="sec-content" style="${sec.content.includes('##') ? 'white-space: normal;' : ''}">${sec.content.includes('##') ? sec.content.replace(/##([\s\S]*?)##/g, '$1') : (sec.content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n\s*\n/g, '\n').trim())}</div>
                        </div>
                    `}).join('');

                    // AUTO-APPLY CUSTOM MEDIA
                    if (item.media_url) {
                        console.log("Auto-applying media for item:", item.media_url);
                        selectMedia(item.media_url, item.media_type, null, 'global');
                    }

                    // AUTO-APPLY CUSTOM STYLES
                    const target = (window.currentItemType === 'live') ? 'live-lyrics' : (window.currentItemType === 'live2' ? 'live2-lyrics' : 'lyrics');
                    if (item.style_json) {
                        try {
                            const customStyles = JSON.parse(item.style_json);
                            console.log("Applying custom styles for item:", customStyles);
                            socket.emit('style_update', { target: target, styles: customStyles });
                            setStyleForm(customStyles, ''); // Update controller UI
                        } catch (e) {
                            console.error("Error applying custom styles:", e);
                        }
                    } else if (window.globalStyleDefaults[target]) {
                        // FALLBACK TO GLOBAL
                        const gStyles = window.globalStyleDefaults[target];
                        socket.emit('style_update', { target: target, styles: gStyles });
                        setStyleForm(gStyles, '');
                    }

                    // AUTO-PROJECT FIRST SECTION
                    if (autoProject && item.sections && item.sections.length > 0) {
                        const first = item.sections[0];
                        // Small delay to ensure DOM is ready for highlighting
                        setTimeout(() => emitSection(first.tag, first.content), 50);
                    }
                });
        }

        window.pinMediaToCurrentItem = (url, type) => {
            if (!window.currentSongId) {
                showAlert("Please select a song or item first!");
                return;
            }

            let route = `/songs/${window.currentSongId}/update_media`;
            if (window.currentItemType === 'live') route = `/live/${window.currentSongId}/update_media`;
            else if (window.currentItemType === 'live2') route = `/live2/${window.currentSongId}/update_media`;
            else if (window.currentItemType === 'announcements') route = `/announcements/${window.currentSongId}/update_media`;

            fetch(route, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url, type })
            }).then(res => res.json())
                .then(data => {
                    if (data.status === 'success') {
                        showAlert("Applied! This media will now load whenever you select this song.");
                    }
                });
        };

        window.selectServiceItem = (itemType, itemId, element) => {
            document.querySelectorAll('#service-lineup .list-item').forEach(el => el.classList.remove('active'));
            element.classList.add('active');
            if (itemType === 'song') window.previewSong(itemId, true);
            else if (itemType === 'live') window.previewLive(itemId, true);
            else if (itemType === 'live2') window.previewLive2(itemId, true);
            else if (itemType === 'announcement') window.previewAnnouncement(itemId, true);
        };

        window.pinStyleToCurrentItem = () => {
            if (!window.currentSongId) {
                showAlert("Please select an item first!");
                return;
            }

            let styles;
            let route = `/songs/${window.currentSongId}/update_style`;
            
            if (window.currentItemType === 'live') route = `/live/${window.currentSongId}/update_style`;
            else if (window.currentItemType === 'live2') route = `/live2/${window.currentSongId}/update_style`;
            else if (window.currentItemType === 'announcements') route = `/announcements/${window.currentSongId}/update_style`;

            if (window.currentItemType === 'announcements') {
                styles = {
                    header: getStyleObject('ah-'),
                    content: getStyleObject('ac-')
                };
            } else {
                let prefix = '';
                if (window.currentItemType === 'birthdays') prefix = 'bc-';
                styles = getStyleObject(prefix);
            }
            
            if (!styles) return;

            fetch(route, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ style: JSON.stringify(styles) })
            }).then(res => res.json())
                .then(data => {
                    if (data.status === 'success') {
                        showAlert("Applied! This specific look is now saved for this item.");
                        // Emit individual updates to current output
                        if (window.currentItemType === 'announcements') {
                            if (styles.header) socket.emit('style_update', { target: 'announcement-header', styles: styles.header });
                            if (styles.content) socket.emit('style_update', { target: 'announcement-content', styles: styles.content });
                        } else {
                            let target = 'lyrics';
                            if (window.currentItemType === 'live') target = 'live-lyrics';
                            else if (window.currentItemType === 'live2') target = 'live2-lyrics';
                            socket.emit('style_update', { target, styles });
                        }
                    }
                });
        };

        // Attach pin button event if it exists
        const btnPin = document.getElementById('btn-pin-style');
        if (btnPin) btnPin.onclick = window.pinStyleToCurrentItem;

        window.emitSection = (tag, content) => {
            // Highlight in preview
            document.querySelectorAll('.song-section').forEach(el => el.classList.remove('active'));
            document.querySelectorAll('.sec-btn').forEach(el => el.classList.remove('active'));

            const activeSec = document.getElementById(`sec-${tag}`);
            // Find button by tag
            const activeBtn = Array.from(document.querySelectorAll('.sec-btn')).find(b => b.innerText === tag);

            if (activeSec) {
                activeSec.classList.add('active');
                activeSec.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
            }
            if (activeBtn) activeBtn.classList.add('active');

            socket.emit('select_section', {
                tag: tag,
                content: content,
                song_title: document.getElementById('current-song-title').innerText,
                source_type: window.currentItemType || 'song'  // Track which library is projecting
            });

            // Emit current styling based on active source type
            let target = 'lyrics';
            if (window.currentItemType === 'live') {
                target = 'live-lyrics';
            } else if (window.currentItemType === 'live2') {
                target = 'live2-lyrics';
            }

            const currentStyles = getStyleObject();
            if (currentStyles) socket.emit('style_update', { target: target, styles: currentStyles });
        };

        window.setAsDefaultMedia = (url, type) => {
            const ctx = getPageContext();

            // Save to localStorage as well for immediate reliability
            saveLastMediaForContext(url, type);

            const key = `default-media-${ctx}`;
            const data = {};
            data[key] = JSON.stringify({ url, type });

            fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            }).then(res => res.json())
                .then(result => {
                    if (result.status === 'success') {
                        showAlert(`Default media for ${ctx} saved!`, "Success");
                    }
                });
        };

        window.setAsStartupMedia = (url, type) => {
            const key = `default-media-startup`;
            const data = {};
            data[key] = JSON.stringify({ url, type });

            fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            }).then(res => res.json())
                .then(result => {
                    if (result.status === 'success') {
                        showAlert(`Startup output media saved!`, "Success");
                    }
                });
        };

        // Keyboard Shortcuts State
        let activeKeyChar = null;

        document.addEventListener('keydown', (e) => {
            if (!sectionBtns) return;
            // Ignore if focus is on inputs
            if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;

            const btns = Array.from(sectionBtns.querySelectorAll('.sec-btn'));
            const activeIdx = btns.findIndex(b => b.classList.contains('active'));

            // Arrow Keys for Next/Prev
            if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                if (activeIdx < btns.length - 1) btns[activeIdx + 1].click();
                else if (activeIdx === -1 && btns.length > 0) btns[0].click();
                e.preventDefault();
                return;
            } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                if (activeIdx > 0) btns[activeIdx - 1].click();
                e.preventDefault();
                return;
            }

            // Track held alphabetic keys
            if (e.key.length === 1 && /[a-zA-Z]/.test(e.key)) {
                activeKeyChar = e.key.toUpperCase();
            }

            // Mapping dictionary for single key presses
            const shortcutMap = {
                'I': 'I1',
                'C': 'C1',
                'B': 'B1',
                'P': 'PC1',
                'V': 'V1',
                'O': 'O1',
                'R': 'R1',
                'T': 'T1'
            };

            // Handle Number Presses (1-9)
            if (e.key >= '1' && e.key <= '9') {
                if (activeKeyChar) {
                    // Holding a character + Number (e.g. C + 2 = C2)
                    // P is a special case since PC1 is mapped to P
                    let targetTag = activeKeyChar === 'P' ? `PC${e.key}` : `${activeKeyChar}${e.key}`;
                    const targetBtn = btns.find(b => b.dataset.tag.toUpperCase() === targetTag);
                    if (targetBtn) targetBtn.click();
                } else {
                    // Standard 1-9 index based pressing
                    const num = parseInt(e.key) - 1;
                    if (btns[num]) btns[num].click();
                }
                e.preventDefault();
                return;
            }

            // Handle Single Alphabetic Key Presses (when not combined with numbers)
            if (e.key.length === 1 && /[a-zA-Z]/.test(e.key)) {
                const char = e.key.toUpperCase();
                if (shortcutMap[char]) {
                    const targetBtn = btns.find(b => b.dataset.tag.toUpperCase() === shortcutMap[char]);
                    if (targetBtn) targetBtn.click();
                }
            }
        });

        document.addEventListener('keyup', (e) => {
            if (e.key.length === 1 && e.key.toUpperCase() === activeKeyChar) {
                activeKeyChar = null;
            }
        });

        // Media Management (Upload & Folders)
        const btnOpenUpload = document.getElementById('btn-open-upload');
        const uploadPanel = document.getElementById('upload-panel');
        const uploadFolderSelect = document.getElementById('upload-folder-select');
        const btnNewFolder = document.getElementById('btn-new-folder');
        const btnDoUpload = document.getElementById('btn-do-upload');
        const uploadInput = document.getElementById('media-upload-input');

        function refreshFolderList() {
            if (!uploadFolderSelect) return;
            fetch('/api/videos/folders')
                .then(res => res.json())
                .then(folders => {
                    uploadFolderSelect.innerHTML = folders.map(f => `
                        <option value="${f}">${f.charAt(0).toUpperCase() + f.slice(1)}</option>
                    `).join('');
                });
        }

        if (btnOpenUpload) {
            btnOpenUpload.onclick = () => {
                uploadPanel.classList.toggle('hidden');
                if (!uploadPanel.classList.contains('hidden')) {
                    refreshFolderList();
                }
            };
        }

        if (btnNewFolder) {
            btnNewFolder.onclick = () => {
                const name = prompt("Enter folder name:");
                if (name) {
                    fetch('/api/videos/create-folder', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ name: name })
                    }).then(res => res.json())
                        .then(data => {
                            if (data.status === 'success') {
                                showAlert("Folder created!", "Success");
                                refreshFolderList();
                                // Refresh filters
                                fetch('/api/videos/')
                                    .then(res => res.json())
                                    .then(items => {
                                        mediaCache = items;
                                        renderMediaFilters(items, 'global');
                                        renderMediaFilters(items, 'inline');
                                    });
                            } else {
                                showAlert(data.error || "Failed to create folder", "Error");
                            }
                        });
                }
            };
        }

        const btnAddBrowser = document.getElementById('btn-add-browser');
        if (btnAddBrowser) {
            btnAddBrowser.onclick = () => {
                const bodyHtml = `
                    <div class="modal-form-group">
                        <label>Name</label>
                        <input type="text" id="bs-name" placeholder="e.g. YouTube Live, Lower Third Overlay">
                    </div>
                    <div class="modal-form-group">
                        <label>URL (Auto-converts YouTube/Vimeo/etc.)</label>
                        <input type="text" id="bs-url" placeholder="https://...">
                    </div>
                    <div class="modal-form-row">
                        <div class="modal-form-group">
                            <label>Width</label>
                            <input type="text" id="bs-width" value="100%" placeholder="100% or 1920px">
                        </div>
                        <div class="modal-form-group">
                            <label>Height</label>
                            <input type="text" id="bs-height" value="100%" placeholder="100% or 1080px">
                        </div>
                    </div>
                    <div class="modal-form-group" style="display: flex; align-items: center; gap: 10px;">
                        <input type="checkbox" id="bs-proxy" style="width: auto;">
                        <label style="margin: 0;">Use Proxy (Helpful for sites that block iframes)</label>
                    </div>
                    <div class="modal-form-group" style="display: flex; align-items: center; gap: 10px;">
                        <input type="checkbox" id="bs-interact" style="width: auto;">
                        <label style="margin: 0;">Allow Interaction (Controls click/scroll)</label>
                    </div>
                    <div class="modal-form-group">
                        <label>Target Folder</label>
                        <select id="bs-folder"></select>
                    </div>
                    <div class="modal-form-group">
                        <label>Custom CSS (Applied only via Proxy or same-site)</label>
                        <textarea id="bs-css" rows="3" placeholder="body { background: transparent; }"></textarea>
                    </div>
                `;

                window.openUniversalModal("Add Browser Source", bodyHtml, "Add Source", () => {
                    const name = document.getElementById('bs-name').value;
                    let url = document.getElementById('bs-url').value;
                    const width = document.getElementById('bs-width').value;
                    const height = document.getElementById('bs-height').value;
                    const css = document.getElementById('bs-css').value;
                    const useProxy = document.getElementById('bs-proxy').checked;
                    const interact = document.getElementById('bs-interact').checked;
                    const folder = document.getElementById('bs-folder').value;

                    if (!name || !url) return showAlert("Name and URL are required!");

                    url = window.transformUrl(url);
                    if (useProxy) {
                        url = `${window.location.origin}/api/videos/proxy?url=${encodeURIComponent(url)}`;
                    }

                    const payload = {
                        name: name,
                        url: JSON.stringify({
                            url: url,
                            css: css,
                            width: width,
                            height: height,
                            interact: interact
                        }),
                        category: folder || 'general'
                    };

                    // Note: We are hijacking 'url' field to store JSON. Our updated backend handles this.
                    fetch('/api/videos/add-browser-source', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    }).then(res => res.json())
                        .then(data => {
                            if (data.status === 'success') {
                                showAlert('Browser source added!', 'Success');
                                closeUniversalModal();
                                if (typeof refreshFolderList === 'function') refreshFolderList();
                                loadMedia('global');
                            } else {
                                showAlert(data.error || 'Failed to add source', 'Error');
                            }
                        });
                });

                // Populate folders
                fetch('/api/videos/folders')
                    .then(res => res.json())
                    .then(folders => {
                        const select = document.getElementById('bs-folder');
                        if (select) {
                            select.innerHTML = folders.map(f => `<option value="${f}">${f}</option>`).join('');
                        }
                    });
            };
        }

        if (btnDoUpload) {
            btnDoUpload.onclick = () => {
                if (!uploadInput.files[0]) {
                    showAlert("Please select a file.", "Warning");
                    return;
                }

                const formData = new FormData();
                formData.append('file', uploadInput.files[0]);
                formData.append('category', uploadFolderSelect.value);

                btnDoUpload.disabled = true;
                btnDoUpload.innerText = "Uploading...";

                fetch('/api/videos/upload', {
                    method: 'POST',
                    body: formData
                }).then(res => res.json())
                    .then(data => {
                        btnDoUpload.disabled = false;
                        btnDoUpload.innerText = "Start Upload";
                        if (data.status === 'success') {
                            showAlert("Media uploaded successfully!", "Success");
                            uploadInput.value = '';
                            uploadPanel.classList.add('hidden');
                            // Refresh library
                            loadMedia('global');
                            loadMedia('inline');
                        } else {
                            showAlert(data.error || "Upload failed", "Error");
                        }
                    });
            };
        }

        const btnDeleteFolder = document.getElementById('btn-delete-folder');
        if (btnDeleteFolder) {
            btnDeleteFolder.onclick = () => {
                const folder = uploadFolderSelect.value;
                if (!folder || folder === 'general') {
                    showAlert("Cannot delete the root 'general' folder.", "Warning");
                    return;
                }

                showConfirm(`Permanently delete folder '${folder}' and ALL its contents? This cannot be undone.`, () => {
                    fetch('/api/videos/delete-folder', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ name: folder })
                    }).then(res => res.json())
                        .then(data => {
                            if (data.status === 'success') {
                                showAlert("Folder deleted.", "Success");
                                refreshFolderList();
                                loadMedia('global');
                                loadMedia('inline');
                            } else {
                                showAlert(data.error || "Failed to delete folder.", "Error");
                            }
                        });
                }, "Warning: Deleting Folder");
            };
        }
    }

    window.deleteMedia = (url) => {
        showConfirm("Are you sure you want to delete this media file? This cannot be undone.", () => {
            fetch('/api/videos/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: url })
            }).then(res => res.json())
                .then(data => {
                    if (data.status === 'success') {
                        showAlert("File deleted.", "Success");
                        loadMedia('global');
                        loadMedia('inline');
                    } else {
                        showAlert(data.error || "Failed to delete file.", "Error");
                    }
                });
        }, "Warning: Deleting File");
    };

    // --- Output Page Logic ---
    if (document.body.classList.contains('output-page')) {
        const lyricsText = document.getElementById('lyrics-text');
        const liveText = document.getElementById('live-text');
        const live2Text = document.getElementById('live2-text');

        function setHTMLAndExecute(element, html) {
            element.innerHTML = html;

            // Execute Scripts
            Array.from(element.querySelectorAll('script')).forEach(oldScript => {
                const newScript = document.createElement('script');
                Array.from(oldScript.attributes).forEach(attr => newScript.setAttribute(attr.name, attr.value));
                newScript.appendChild(document.createTextNode(oldScript.innerHTML));
                oldScript.parentNode.replaceChild(newScript, oldScript);
            });

            // Handle Video Playback & Sound Sync
            const isOutput = window.location.pathname.startsWith('/output');
            Array.from(element.querySelectorAll('video')).forEach(vid => {
                if (isOutput) {
                    vid.muted = true; // Output is usually passive, mute to ensure autoplay
                } else {
                    vid.muted = false; // Controller is active, allow sound
                    vid.volume = 1.0;
                }

                // Ensure it plays
                if (vid.hasAttribute('autoplay')) {
                    vid.play().catch(e => console.log("Autoplay blocked/failed:", e));
                }
            });
        }

        socket.on('update_slide', (data) => {
            hideAllOutput({ keepPres: true });

            let targetEl = lyricsText;
            let settingsKey = 'lyrics';
            if (data.source_type === 'live') {
                targetEl = liveText;
                settingsKey = 'live-lyrics';
            } else if (data.source_type === 'live2') {
                targetEl = live2Text;
                settingsKey = 'live2-lyrics';
            }

            // Re-apply saved styles for this module
            if (window.outputSettings && window.outputSettings[settingsKey]) {
                try {
                    const styles = JSON.parse(window.outputSettings[settingsKey]);
                    applyStylesToElement(targetEl, styles);
                } catch (e) { console.error("Error applying persisting style:", settingsKey, e); }
            }

            // Allow override of speed and style from html data attributes loaded via apply_style
            let durationSec = parseFloat(targetEl.dataset.animSpeed) || 0.5;
            let durationMs = durationSec * 1000;

            targetEl.classList.remove('hidden');
            targetEl.classList.remove('fade-in');
            targetEl.classList.add('fade-out');

            setTimeout(() => {
                let content = data.content;
                if (content.includes('##')) {
                    // HTML Mode: Strip delimiters and treat as raw HTML
                    targetEl.style.whiteSpace = 'normal';
                    const htmlContent = content.replace(/##([\s\S]*?)##/g, '$1');
                    setHTMLAndExecute(targetEl, htmlContent);
                } else {
                    // Text Mode: Preserve formatting via CSS, support <emp> tags via innerHTML
                    const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
                    const cleaned = normalized.replace(/\n\s*\n/g, '\n').trim();
                    targetEl.style.whiteSpace = 'pre-line';
                    targetEl.innerHTML = cleaned;
                }

                targetEl.classList.remove('fade-out');
                targetEl.classList.add('fade-in');
            }, durationMs);
        });

        socket.on('update_birthday_slide', (data) => {
            hideAllOutput();
            const bOutput = document.getElementById('birthday-output');
            if (bOutput) {
                bOutput.classList.remove('hidden');
                const headEl = document.getElementById('birthday-header');
                const listEl = document.getElementById('birthday-list');

                if (headEl) headEl.innerText = data.header;
                if (listEl) listEl.innerHTML = data.celebrants.map(b => `<li>${b.name} (${b.formatted_date})</li>`).join('');

                // Apply saved styles
                const parts = { 'birthday-header': 'birthday-header', 'birthday-content': 'birthday-list' };
                Object.keys(parts).forEach(key => {
                    const el = document.getElementById(parts[key]);
                    if (el && window.outputSettings && window.outputSettings[key]) {
                        try {
                            const styles = JSON.parse(window.outputSettings[key]);
                            const sCopy = { ...styles };
                            if (sCopy.alignSelf) {
                                bOutput.style.alignSelf = sCopy.alignSelf;
                                delete sCopy.alignSelf;
                            }
                            applyStylesToElement(el, sCopy);
                        } catch (e) { }
                    }
                });
            }
        });

        socket.on('update_announcement_slide', (data) => {
            hideAllOutput();
            const aOutput = document.getElementById('announcement-output');
            if (aOutput) {
                aOutput.classList.remove('hidden');

                // Robust Detection: No Title AND contains <video or <iframe
                const c = (data.content || '').trim().toLowerCase();
                const hasMedia = c.includes('<video') || c.includes('<iframe');
                const isMediaOnly = !data.title.trim() && hasMedia;

                if (isMediaOnly) {
                    aOutput.classList.add('full-screen');
                } else {
                    aOutput.classList.remove('full-screen');
                }

                const titleEl = document.getElementById('announcement-title');
                const contentEl = document.getElementById('announcement-content');

                if (titleEl) titleEl.innerHTML = data.title;
                if (contentEl) setHTMLAndExecute(contentEl, data.content);

                // Apply saved styles for Header and Content
                const parts = {
                    'announcement-header': 'announcement-title',
                    'announcement-content': 'announcement-content'
                };

                Object.keys(parts).forEach(key => {
                    const el = document.getElementById(parts[key]);
                    if (el && window.outputSettings && window.outputSettings[key]) {
                        try {
                            const styles = JSON.parse(window.outputSettings[key]);
                            const sCopy = { ...styles };

                            // Handle vertical position via container
                            if (sCopy.alignSelf && aOutput) {
                                aOutput.style.alignSelf = sCopy.alignSelf;
                                delete sCopy.alignSelf;
                            }
                            applyStylesToElement(el, sCopy);
                        } catch (e) { console.error("Style apply error", key, e); }
                    }
                });
            }
        });

        socket.on('update_bible_slide', (data) => {
            hideAllOutput();
            const bOutput = document.getElementById('bible-output');
            if (bOutput) {
                bOutput.classList.remove('hidden');
                document.getElementById('bible-reference').innerText = data.verse;
                document.getElementById('bible-text-content').innerHTML = data.content;

                let pEl = document.getElementById('bible-parallel-content');
                if (data.parallel_content) {
                    if (pEl) {
                        pEl.innerHTML = data.parallel_content;
                        pEl.classList.remove('hidden');
                    }
                } else if (pEl) {
                    pEl.innerHTML = '';
                    pEl.classList.add('hidden');
                }

                // Apply saved styles for Reference, Content, and Parallel
                const parts = {
                    'bible-header': 'bible-reference',
                    'bible-content': 'bible-text-content',
                    'bible-parallel': 'bible-parallel-content'
                };

                Object.keys(parts).forEach(key => {
                    const el = document.getElementById(parts[key]);
                    if (el && window.outputSettings && window.outputSettings[key]) {
                        try {
                            const styles = JSON.parse(window.outputSettings[key]);
                            const sCopy = { ...styles };

                            // Only apply alignSelf (vertical pos) to container for bible-header
                            if (key === 'bible-header' && sCopy.alignSelf) {
                                bOutput.style.alignSelf = sCopy.alignSelf;
                                delete sCopy.alignSelf;
                            } else {
                                delete sCopy.alignSelf; // Ensure it doesn't try to align itself on the child
                            }
                            applyStylesToElement(el, sCopy);
                        } catch (e) { console.error("Style apply error", key, e); }
                    }
                });
            }
        });

        socket.on('clear_output', () => {
            hideAllOutput();
        });


        function hideAllOutput() {
            lyricsText.classList.add('hidden');
            lyricsText.innerHTML = '';
            liveText.classList.add('hidden');
            liveText.innerHTML = '';
            live2Text.classList.add('hidden');
            live2Text.innerHTML = '';

            const bdayOut = document.getElementById('birthday-output');
            if (bdayOut) {
                bdayOut.classList.add('hidden');
                document.getElementById('birthday-list').innerHTML = '';
            }

            const annOut = document.getElementById('announcement-output');
            if (annOut) {
                annOut.classList.add('hidden');
                document.getElementById('announcement-title').innerHTML = '';
                document.getElementById('announcement-content').innerHTML = '';
            }

            const bOutput = document.getElementById('bible-output');
            if (bOutput) {
                bOutput.classList.add('hidden');
                document.getElementById('bible-reference').innerText = '';
                document.getElementById('bible-text-content').innerHTML = '';
            }

            const presLayer = document.getElementById('pres-layer');
            if (presLayer && !arguments[0]?.keepPres) {
                presLayer.classList.add('hidden');
                presLayer.classList.remove('active');
            }
        }

        let currentLayerIndex = 1;
        function applyVideoPayload(data) {
            const nextLayerIndex = currentLayerIndex === 1 ? 2 : 1;
            const currentLayer = document.getElementById(`media-layer-${currentLayerIndex}`);
            const nextLayer = document.getElementById(`media-layer-${nextLayerIndex}`);

            const nextVideo = nextLayer.querySelector('.video-el');
            const nextImg = nextLayer.querySelector('.img-el');
            const nextIframe = nextLayer.querySelector('.iframe-el');

            if (!data.url) {
                currentLayer.classList.remove('active');
                nextLayer.classList.remove('active');
                setTimeout(() => {
                    nextVideo.classList.add('hidden');
                    nextImg.classList.add('hidden');
                    if (nextIframe) nextIframe.classList.add('hidden');
                    nextVideo.pause();
                }, 1000);
                return;
            }

            // Prepare next layer
            nextVideo.classList.add('hidden');
            nextImg.classList.add('hidden');
            if (nextIframe) nextIframe.classList.add('hidden');

            let mediaEl;
            if (data.type === 'video') mediaEl = nextVideo;
            else if (data.type === 'browser') {
                mediaEl = nextIframe;
                // OBS styling: size & pointer events
                mediaEl.style.width = data.width || '100%';
                mediaEl.style.height = data.height || '100%';
                mediaEl.style.pointerEvents = data.interact ? 'auto' : 'none';

                // Position and Center
                if (data.width && data.width !== '100%') {
                    mediaEl.style.left = '50%';
                    mediaEl.style.top = '50%';
                    mediaEl.style.transform = 'translate(-50%, -50%)';
                } else {
                    mediaEl.style.left = '0';
                    mediaEl.style.top = '0';
                    mediaEl.style.transform = 'none';
                }
            }
            else mediaEl = nextImg;

            const triggerCrossfade = () => {
                // If it already faded in, skip
                if (nextLayer.classList.contains('active')) return;

                nextLayer.classList.add('active');
                currentLayer.classList.remove('active');

                currentLayerIndex = nextLayerIndex;

                // Cleanup previous layer after fade
                setTimeout(() => {
                    const prevLayer = document.getElementById(`media-layer-${currentLayerIndex === 1 ? 2 : 1}`);
                    const prevVideo = prevLayer.querySelector('.video-el');
                    const prevIframe = prevLayer.querySelector('.iframe-el');
                    if (currentLayerIndex !== (currentLayerIndex === 1 ? 2 : 1)) { // Ensure it didn't switch back
                        if (prevVideo) prevVideo.pause();
                        if (prevIframe) prevIframe.src = ''; // ALWAYS clear previous iframe to stop hidden WebRTC from causing lag
                    }
                }, 1100);
            };

            if (mediaEl) {
                // Determine if we need to load or it's instant
                let readyFired = false;
                const onReady = () => {
                    if (readyFired) return;
                    readyFired = true;
                    setTimeout(triggerCrossfade, 50); // slight delay to allow rendering
                };

                // Fallback timeout in case the source never completely "loads"
                const safetyTimeout = setTimeout(onReady, data.type === 'browser' ? 8000 : 3000);

                if (data.type === 'video') {
                    mediaEl.muted = true;

                    mediaEl.onloadeddata = () => { clearTimeout(safetyTimeout); onReady(); };
                    mediaEl.oncanplay = () => { clearTimeout(safetyTimeout); onReady(); };
                } else if (data.type === 'image') {
                    mediaEl.onload = () => { clearTimeout(safetyTimeout); onReady(); };
                } else if (data.type === 'browser') {
                    // For WebRTC browser sources like VDO.ninja, onload fires immediately when HTML parses,
                    // but the P2P connection physically takes 2-3s to establish. Delay the visual crossfade.
                    mediaEl.onload = () => {
                        clearTimeout(safetyTimeout);
                        setTimeout(onReady, 3500); // 3.5s silent background connection buffer
                    };
                }

                mediaEl.src = data.url;
                mediaEl.classList.remove('hidden');

                // Custom CSS for Browser Source (Inject if same-origin, apply filter otherwise)
                if (data.type === 'browser') {
                    // Try to apply generic filters if we have styles (opacity etc)
                    if (data.opacity !== undefined) mediaEl.style.opacity = data.opacity;
                }

                // Apply styles (iframes don't use objectPosition, but we apply to existing elements safely)
                [nextVideo, nextImg].forEach(el => {
                    if (el) {
                        el.classList.remove('fit', 'fill', 'stretch');
                        el.classList.add(data.resizeMode || 'fill');
                        el.style.objectPosition = `${data.posX || 50}% ${data.posY || 50}%`;
                    }
                });

                if (data.type === 'video') {
                    nextVideo.load();
                    nextVideo.play().catch(e => console.log("Video play failed:", e));
                }
            } else {
                triggerCrossfade(); // If it's empty/no mediaEl, fade instantly
            }
        }

        socket.on('apply_video', applyVideoPayload);

        socket.on('apply_style', (data) => {
            if (data.target && data.target.endsWith('-emp')) {
                let ruleId = data.target + '-style';
                let styleEl = document.getElementById(ruleId);
                if (!styleEl) {
                    styleEl = document.createElement('style');
                    styleEl.id = ruleId;
                    document.head.appendChild(styleEl);
                }

                let containerSelectors = [];
                if (data.target === 'lyrics-emp') containerSelectors = ['#lyrics-text', '#song-preview-content'];
                if (data.target === 'live-emp') containerSelectors = ['#live-text', '#song-preview-content'];
                if (data.target === 'live2-emp') containerSelectors = ['#live2-text', '#song-preview-content'];

                const s = data.styles;
                if (containerSelectors.length > 0 && s) {
                    const finalSelectors = containerSelectors.map(sel => sel + ' emp').join(', ');
                    styleEl.innerHTML = `
                        ${finalSelectors} {
                            font-family: ${s.fontFamily || 'inherit'};
                            font-size: ${s.fontSize || '1em'};
                            color: ${s.color || 'inherit'};
                            text-shadow: ${s.textShadow || 'none'};
                            font-weight: ${s.fontWeight || 'normal'};
                            font-style: ${s.fontStyle || 'normal'};
                            text-transform: ${s.textTransform || 'none'};
                            -webkit-text-stroke: ${s.webkitTextStroke || '0px transparent'};
                        }
                    `;
                }
                return;
            }

            const targetMap = {
                'lyrics': 'lyrics-text',
                'live-lyrics': 'live-text',
                'live2-lyrics': 'live2-text',
                'birthday-header': 'birthday-header',
                'birthday-content': 'birthday-list',
                'announcement-header': 'announcement-title',
                'announcement-content': 'announcement-content',
                'bible-header': 'bible-reference',
                'bible-content': 'bible-text-content',
                'bible-parallel': 'bible-parallel-content'
            };

            const targetId = targetMap[data.target];
            if (!targetId) return;

            const el = document.getElementById(targetId);
            if (el && data.styles) {
                const stylesToApply = { ...data.styles };

                // If the target is part of a group, handle vertical align via the container
                if (data.target.includes('birthday') || data.target.includes('announcement') || data.target.includes('bible')) {
                    const containerId = data.target.includes('birthday') ? 'birthday-output' :
                        data.target.includes('announcement') ? 'announcement-output' : 'bible-output';
                    const container = document.getElementById(containerId);
                    if (container && stylesToApply.alignSelf) {
                        container.style.alignSelf = stylesToApply.alignSelf;
                        // Prevent individual child from moving horizontally if container is flex-column
                        delete stylesToApply.alignSelf;
                    }
                }
                // Synchronize into memory so selection events use latest style
                if (window.outputSettings) {
                    window.outputSettings[data.target] = JSON.stringify(stylesToApply);
                }
                
                applyStylesToElement(el, stylesToApply);
            }
        });

        let currentPdfDoc = null;
        let lastPdfUrl = null;
        let currentPresCanvasIndex = 1;

        socket.on('apply_presentation', async (data) => {
            console.log('DEBUG: Received apply_presentation event:', data);
            const presLayer = document.getElementById('pres-layer');
            if (!presLayer) return;

            const nextCanvasIndex = currentPresCanvasIndex === 1 ? 2 : 1;
            const currentCanvas = document.getElementById(`pres-canvas-${currentPresCanvasIndex}`);
            const nextCanvas = document.getElementById(`pres-canvas-${nextCanvasIndex}`);

            if (!nextCanvas) return;

            if (lastPdfUrl !== data.url) {
                currentPdfDoc = await pdfjsLib.getDocument(data.url).promise;
                lastPdfUrl = data.url;
            }

            const page = await currentPdfDoc.getPage(data.page_num);
            const context = nextCanvas.getContext('2d');
            const viewport = page.getViewport({ scale: 3.0 });

            nextCanvas.height = viewport.height;
            nextCanvas.width = viewport.width;

            await page.render({
                canvasContext: context,
                viewport: viewport
            }).promise;

            hideAllOutput({ keepPres: true });
            presLayer.classList.remove('hidden');

            nextCanvas.style.opacity = '1';
            if (currentCanvas) currentCanvas.style.opacity = '0';

            currentPresCanvasIndex = nextCanvasIndex;
            presLayer.classList.add('active');
        });

        const pointerEl = document.getElementById('pres-pointer');
        socket.on('powerpoint_pointer_relay', (data) => {
            if (!pointerEl) return;
            if (data.active) {
                pointerEl.style.display = 'block';
                pointerEl.style.left = `${data.x}%`;
                pointerEl.style.top = `${data.y}%`;
            } else {
                pointerEl.style.display = 'none';
            }
        });

        socket.on('powerpoint_pointer_color_relay', (data) => {
            if (!pointerEl) return;
            pointerEl.style.backgroundColor = data.color;
            pointerEl.style.boxShadow = `0 0 10px ${data.color}, 0 0 20px ${data.color}`;
        });

        socket.on('powerpoint_pointer_size_relay', (data) => {
            if (!pointerEl) return;
            pointerEl.style.width = `${data.size}px`;
            pointerEl.style.height = `${data.size}px`;
        });

        socket.on('powerpoint_state_update_relay', (data) => {
            if (pointerEl) {
                if (data.pointer_color) {
                    pointerEl.style.backgroundColor = data.pointer_color;
                    pointerEl.style.boxShadow = `0 0 10px ${data.pointer_color}, 0 0 20px ${data.pointer_color}`;
                }
                if (data.pointer_size) {
                    pointerEl.style.width = `${data.pointer_size}px`;
                    pointerEl.style.height = `${data.pointer_size}px`;
                }
            }
        });

        // Initial style apply when Output connects
        window.outputSettings = {}; // Cache settings globally for the output page

        fetch('/api/settings')
            .then(res => res.json())
            .then(data => {
                window.outputSettings = data; // Store in cache

                socket.on('style_update_relay', (data) => {
                    const targets = {
                        'lyrics': lyricsText,
                        'live-lyrics': liveText,
                        'live2-lyrics': live2Text,
                        'birthday-header': document.getElementById('birthday-header'),
                        'birthday-content': document.getElementById('birthday-list'),
                        'announcement-header': document.getElementById('announcement-title'),
                        'announcement-content': document.getElementById('announcement-content'),
                        'bible-header': document.getElementById('bible-reference'),
                        'bible-content': document.getElementById('bible-text-content'),
                        'bible-parallel': document.getElementById('bible-parallel-content')
                    };

                    // Update global settings cache so newly created elements (like bible parallel) get the live style
                    if (window.outputSettings) {
                        window.outputSettings[data.target] = JSON.stringify(data.styles);
                    }

                    const el = targets[data.target];
                    if (el) {
                        const stylesToApply = { ...data.styles };

                        // If the target is part of a group, handle vertical align via the container
                        if (data.target.includes('birthday') || data.target.includes('announcement') || data.target.includes('bible')) {
                            const containerId = data.target.includes('birthday') ? 'birthday-output' :
                                data.target.includes('announcement') ? 'announcement-output' : 'bible-output';
                            const container = document.getElementById(containerId);
                            if (container && stylesToApply.alignSelf) {
                                container.style.alignSelf = stylesToApply.alignSelf;
                                delete stylesToApply.alignSelf;
                            }
                        }
                        applyStylesToElement(el, stylesToApply);
                    }
                });

                const targets = {
                    'lyrics': lyricsText,
                    'live-lyrics': liveText,
                    'live2-lyrics': live2Text,
                    'birthday-header': document.getElementById('birthday-header'),
                    'birthday-content': document.getElementById('birthday-list'),
                    'announcement-header': document.getElementById('announcement-title'),
                    'announcement-content': document.getElementById('announcement-content'),
                    'bible-header': document.getElementById('bible-reference'),
                    'bible-content': document.getElementById('bible-text-content'),
                    'bible-parallel': document.getElementById('bible-parallel-content')
                };

                Object.keys(targets).forEach(key => {
                    const el = targets[key];
                    if (el && data[key]) {
                        try {
                            const styles = JSON.parse(data[key]);

                            // Special handling for containers (vertical align)
                            if (key.includes('bible') || key.includes('birthday') || key.includes('announcement')) {
                                const containerId = key.includes('bible') ? 'bible-output' :
                                    key.includes('birthday') ? 'birthday-output' : 'announcement-output';
                                const container = document.getElementById(containerId);
                                if (container && styles.alignSelf) {
                                    container.style.alignSelf = styles.alignSelf;
                                    delete styles.alignSelf;
                                }
                            }

                            applyStylesToElement(el, styles);
                        } catch (e) { console.error("Error parsing style for", key, e); }
                    }
                });

                if (data['default-media-startup']) {
                    setTimeout(() => {
                        const activeLayer = document.querySelector('.media-layer.active') || document.getElementById('media-layer-1');
                        const hasMedia = !activeLayer.querySelector('.video-el').classList.contains('hidden') ||
                            !activeLayer.querySelector('.img-el').classList.contains('hidden') ||
                            (activeLayer.querySelector('.iframe-el') && !activeLayer.querySelector('.iframe-el').classList.contains('hidden'));

                        if (!hasMedia) {
                            try {
                                const startup = JSON.parse(data['default-media-startup']);
                                if (startup.url) {
                                    applyVideoPayload({ url: startup.url, type: startup.type, resizeMode: 'fill', posX: 50, posY: 50 });
                                }
                            } catch (e) { console.error("Error parsing startup media", e); }
                        }
                    }, 300);
                }
            });
    }
});
