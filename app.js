// Данные треков
const tracks = {
    '1': {
        title: 'No one noticed',
        artist: 'The Marias',
        image: 'https://avatars.mds.yandex.net/i?id=a3b036bcdd2d49eb7a42cd3f220f0d15f0f1af8f-5180074-images-thumbs&n=13',
        audio: 'https://files.catbox.moe/2nqd32.mp3',
        duration: 204,
        lyrics: [
            { time: 0, text: 'No one noticed' },
            { time: 10, text: 'I was gone' },
            { time: 20, text: 'No one noticed' },
            { time: 30, text: 'I was gone' }
        ]
    }
};

const predefinedPlaylists = {
    'p1': { name: 'Поп', trackIds: ['1'] }
};

// Глобальные переменные
let userPlaylists = JSON.parse(localStorage.getItem('userPlaylists') || '{}');
let currentTrackId = null;
let currentPlaylistId = null;
let isPlaying = false;
let currentLyricIndex = -1;
let isFullscreenLyrics = false;
let showTranslation = false;
let isAutoplayEnabled = localStorage.getItem('autoplay') !== 'false';
let loopMode = localStorage.getItem('loopMode') || 'none';
const audioPlayer = new Audio();

// ==================== Media Session API ====================
function setupMediaSession(track) {
    if (!('mediaSession' in navigator)) return;

    navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title,
        artist: track.artist,
        artwork: [{ src: track.image, sizes: '192x192', type: 'image/jpeg' }]
    });

    navigator.mediaSession.setActionHandler('play', () => {
        audioPlayer.play();
        isPlaying = true;
        updatePlayButton();
    });

    navigator.mediaSession.setActionHandler('pause', () => {
        audioPlayer.pause();
        isPlaying = false;
        updatePlayButton();
    });

    navigator.mediaSession.setActionHandler('previoustrack', playPreviousTrack);
    navigator.mediaSession.setActionHandler('nexttrack', playNextTrack);
}

// ==================== Service Worker ====================
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
        .then(reg => console.log('SW registered:', reg.scope))
        .catch(err => console.error('SW registration failed:', err));
}

// ==================== Основные функции ====================
function togglePlay() {
    const track = tracks[currentTrackId];
    if (!track) return;

    if (isPlaying) {
        audioPlayer.pause();
    } else {
        if (audioPlayer.src !== track.audio) {
            audioPlayer.src = track.audio;
            setupMediaSession(track);
        }
        audioPlayer.play().catch(e => console.error('Play error:', e));
    }
    isPlaying = !isPlaying;
    updatePlayButton();
}

function playNextTrack() {
    if (!currentTrackId || !currentPlaylistId) return;
    const playlist = {...predefinedPlaylists, ...userPlaylists}[currentPlaylistId];
    if (!playlist) return;

    const currentIndex = playlist.trackIds.indexOf(currentTrackId);
    const nextIndex = (currentIndex + 1) % playlist.trackIds.length;
    openTrack(playlist.trackIds[nextIndex], currentPlaylistId);
    if (isPlaying) audioPlayer.play();
}

function playPreviousTrack() {
    if (!currentTrackId || !currentPlaylistId) return;
    const playlist = {...predefinedPlaylists, ...userPlaylists}[currentPlaylistId];
    if (!playlist) return;

    const currentIndex = playlist.trackIds.indexOf(currentTrackId);
    const prevIndex = (currentIndex - 1 + playlist.trackIds.length) % playlist.trackIds.length;
    openTrack(playlist.trackIds[prevIndex], currentPlaylistId);
    if (isPlaying) audioPlayer.play();
}

function toggleLoop() {
    loopMode = loopMode === 'none' ? 'track' : loopMode === 'track' ? 'playlist' : 'none';
    localStorage.setItem('loopMode', loopMode);
    updateLoopButton();
}

function updateLoopButton() {
    const loopText = document.getElementById('loop-text');
    if (loopText) {
        loopText.textContent = `Повтор: ${loopMode === 'none' ? 'Выкл' : loopMode === 'track' ? 'Трек' : 'Плейлист'}`;
    }
}

function updatePlayButton() {
    const playIcon = document.getElementById('play-icon');
    const pauseIcon = document.getElementById('pause-icon');
    const playerPlayIcon = document.getElementById('player-play-icon');
    const playerPauseIcon = document.getElementById('player-pause-icon');
    const fullscreenPlayText = document.getElementById('fullscreen-play-text');

    if (isPlaying) {
        playIcon?.classList.add('hidden');
        pauseIcon?.classList.remove('hidden');
        playerPlayIcon?.classList.add('hidden');
        playerPauseIcon?.classList.remove('hidden');
        if (fullscreenPlayText) fullscreenPlayText.textContent = 'Пауза';
    } else {
        playIcon?.classList.remove('hidden');
        pauseIcon?.classList.add('hidden');
        playerPlayIcon?.classList.remove('hidden');
        playerPauseIcon?.classList.add('hidden');
        if (fullscreenPlayText) fullscreenPlayText.textContent = 'Играть';
    }
}

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function updateProgress() {
    const track = tracks[currentTrackId];
    if (!track) return;

    const currentTime = audioPlayer.currentTime;
    const progress = (currentTime / track.duration) * 100;

    document.getElementById('progress-bar').value = progress;
    document.getElementById('player-progress-bar').value = progress;
    
    document.getElementById('current-time').textContent = formatTime(currentTime);
    document.getElementById('player-current-time').textContent = formatTime(currentTime);
    
    const remaining = track.duration - currentTime;
    document.getElementById('remaining-time').textContent = `-${formatTime(remaining)}`;
    document.getElementById('player-total-time').textContent = formatTime(track.duration);

    updateLyrics();
}

function updateLyrics() {
    const track = tracks[currentTrackId];
    if (!track?.lyrics) return;

    const currentTime = audioPlayer.currentTime;
    let newIndex = -1;

    for (let i = 0; i < track.lyrics.length; i++) {
        if (currentTime >= track.lyrics[i].time) {
            newIndex = i;
        } else {
            break;
        }
    }

    if (newIndex !== currentLyricIndex) {
        const lyrics = document.querySelectorAll('#lyrics-container .lyric-line');
        const fullscreenLyrics = document.querySelectorAll('#fullscreen-lyrics-content .lyric-line');

        if (currentLyricIndex >= 0) {
            lyrics[currentLyricIndex]?.classList.remove('active');
            lyrics[currentLyricIndex]?.classList.add('opacity-60');
            fullscreenLyrics[currentLyricIndex]?.classList.remove('active');
        }

        currentLyricIndex = newIndex;

        if (currentLyricIndex >= 0) {
            lyrics[currentLyricIndex]?.classList.add('active');
            lyrics[currentLyricIndex]?.classList.remove('opacity-60');
            fullscreenLyrics[currentLyricIndex]?.classList.add('active');

            if (!isFullscreenLyrics) {
                lyrics[currentLyricIndex]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } else {
                fullscreenLyrics[currentLyricIndex]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    }
}

function openTrack(trackId, playlistId = null) {
    const track = tracks[trackId];
    if (!track) return;

    currentTrackId = trackId;
    currentPlaylistId = playlistId;
    showTranslation = false;
    currentLyricIndex = -1;

    // Обновляем UI
    document.getElementById('track-image').src = track.image;
    document.getElementById('track-title').textContent = track.title;
    document.getElementById('track-artist').textContent = track.artist;
    document.getElementById('player-image').src = track.image;
    document.getElementById('player-title').textContent = track.title;
    document.getElementById('player-artist').textContent = track.artist;
    document.getElementById('fullscreen-track-title').textContent = track.title;
    document.getElementById('fullscreen-track-artist').textContent = track.artist;

    // Обновляем время
    document.getElementById('total-time').textContent = formatTime(track.duration);
    document.getElementById('player-total-time').textContent = formatTime(track.duration);
    document.getElementById('remaining-time').textContent = `-${formatTime(track.duration)}`;
    
    // Обновляем текст песни
    const lyricsContainer = document.getElementById('lyrics-container');
    lyricsContainer.innerHTML = '';
    track.lyrics.forEach(line => {
        const div = document.createElement('div');
        div.className = 'lyric-line';
        div.textContent = line.text;
        lyricsContainer.appendChild(div);
    });

    const fullscreenLyrics = document.getElementById('fullscreen-lyrics-content');
    fullscreenLyrics.innerHTML = '';
    track.lyrics.forEach(line => {
        const div = document.createElement('div');
        div.className = 'lyric-line';
        div.textContent = line.text;
        fullscreenLyrics.appendChild(div);
    });

    // Настраиваем Media Session
    setupMediaSession(track);

    // Показываем нужные экраны
    document.getElementById('main-view').classList.add('hidden');
    document.getElementById('track-view').classList.remove('hidden');
    document.getElementById('player').classList.remove('hidden');

    // Сбрасываем прогресс
    document.getElementById('progress-bar').value = 0;
    document.getElementById('player-progress-bar').value = 0;
    document.getElementById('current-time').textContent = '00:00';
    document.getElementById('player-current-time').textContent = '00:00';

    // Обновляем кнопки
    updateLoopButton();
    updatePlayButton();
}

function backToMain() {
    document.getElementById('main-view').classList.remove('hidden');
    document.getElementById('track-view').classList.add('hidden');
    document.getElementById('player').classList.add('hidden');
    
    if (isFullscreenLyrics) {
        toggleFullscreenLyrics();
    }
}

function toggleFullscreenLyrics() {
    isFullscreenLyrics = !isFullscreenLyrics;
    
    if (isFullscreenLyrics) {
        document.getElementById('fullscreen-lyrics').classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    } else {
        document.getElementById('fullscreen-lyrics').classList.add('hidden');
        document.body.style.overflow = '';
    }
}

function openPlaylist(playlistId) {
    const playlist = {...predefinedPlaylists, ...userPlaylists}[playlistId];
    if (!playlist) return;

    document.getElementById('main-view').classList.add('hidden');
    document.getElementById('track-view').classList.add('hidden');
    
    let playlistView = document.getElementById('playlist-view');
    if (!playlistView) {
        playlistView = document.createElement('div');
        playlistView.id = 'playlist-view';
        document.getElementById('app').appendChild(playlistView);
    }

    playlistView.innerHTML = `
        <button onclick="backToMain()" class="back-button">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
                <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
        </button>
        <h2 class="section-title">${playlist.name}</h2>
        <div class="grid-container">
            ${playlist.trackIds.map(trackId => {
                const track = tracks[trackId];
                if (!track) return '';
                return `
                    <div class="player-card" onclick="openTrack('${trackId}', '${playlistId}')">
                        <img src="${track.image}" alt="${track.title}" class="track-image">
                        <div class="track-info">
                            <h3>${track.title}</h3>
                            <p>${track.artist}</p>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
    playlistView.classList.remove('hidden');
}

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
    // Настройка аудиоплеера
    audioPlayer.addEventListener('timeupdate', updateProgress);
    audioPlayer.addEventListener('ended', playNextTrack);
    audioPlayer.addEventListener('play', () => {
        isPlaying = true;
        updatePlayButton();
        if ('mediaSession' in navigator) {
            navigator.mediaSession.playbackState = 'playing';
        }
    });
    audioPlayer.addEventListener('pause', () => {
        isPlaying = false;
        updatePlayButton();
        if ('mediaSession' in navigator) {
            navigator.mediaSession.playbackState = 'paused';
        }
    });

    // Загрузка трека из URL
    const urlParams = new URLSearchParams(window.location.search);
    const trackId = urlParams.get('track');
    if (trackId && tracks[trackId]) {
        openTrack(trackId);
    }
});
