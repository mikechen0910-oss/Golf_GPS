let map = null;
    try {
        map = new maplibregl.Map({
            container: 'map',
            style: {
                "version": 8,
                "sources": {
                    "satellite": {
                        "type": "raster",
                        "tiles": ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
                        "tileSize": 256,
                        "attribution": "Tiles © Esri",
                        "maxzoom": 18
                    }
                },
                "layers": [{
                    "id": "satellite",
                    "type": "raster",
                    "source": "satellite",
                    "paint": { "raster-resampling": "linear" }
                }]
            },
            center: [121.5, 25.03],
            zoom: 10,
            maxZoom: 20,
            pitch: 45,
            bearing: 0,
            antialias: true
        });

        map.on('load', () => {
            try { map.resize(); } catch(e){}
            setInfo('地圖載入完成');
        });

        window.addEventListener('resize', () => { try { if (map) map.resize(); } catch(e){} });
    } catch (e) {
        console.error('Map init error', e);
        setInfo('地圖初始化失敗：' + (e && e.message ? e.message : e));
        const m = document.getElementById('map');
        if (m) m.innerHTML = '<div style="color:#fff; padding:20px; text-align:center;">地圖載入失敗，請查看瀏覽器控制台 (Console) 以取得錯誤細節。</div>';
    }

    function locateGPS() {
        setInfo("🛰️ 衛星定位中...");

        if (!navigator.geolocation) {
            setInfo("您的瀏覽器不支援地理定位");
            return;
        }

        let positions = [];
        let attempts = 0;
        const maxAttempts = 5;

        function getPosition() {
            navigator.geolocation.getCurrentPosition(
                (p) => {
                    positions.push({ lng: p.coords.longitude, lat: p.coords.latitude });
                    attempts++;
                    if (attempts < maxAttempts) {
                        setTimeout(getPosition, 1000);
                    } else {
                        const avgLng = positions.reduce((sum, pos) => sum + pos.lng, 0) / positions.length;
                        const avgLat = positions.reduce((sum, pos) => sum + pos.lat, 0) / positions.length;
                        if (userMarker) userMarker.remove();
                        const el = document.createElement('div');
                        el.className = 'user-marker';
                        userMarker = new maplibregl.Marker({ element: el }).setLngLat([avgLng, avgLat]).addTo(map);
                        map.flyTo({ center: [avgLng, avgLat], zoom: 18, pitch: 50, speed: 1.2 });
                        setInfo(`位置已更新 (平均 ${positions.length} 次讀取)`);
                        startPositionWatch();
                        setTimeout(() => getWeatherAtLocation([avgLng, avgLat]), 1500);
                    }
                },
                (err) => {
                    attempts++;
                    let errMsg = '';
                    if (err.code === 1) errMsg = '定位被拒絕，請在設定中允許位置存取';
                    else if (err.code === 2) errMsg = '無法取得位置資訊';
                    else if (err.code === 3) errMsg = '定位逾時，請在開闊區域重試';
                    else errMsg = err.message;

                    if (attempts < maxAttempts) {
                        setTimeout(getPosition, 1500);
                    } else {
                        setInfo(`定位失敗 (${errMsg})`);
                    }
                },
                { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
            );
        }
        getPosition();
    }

    function startPositionWatch() {
        if (positionWatchId) navigator.geolocation.clearWatch(positionWatchId);
        positionWatchId = navigator.geolocation.watchPosition(
            (p) => {
                if (userMarker) {
                    userMarker.setLngLat([p.coords.longitude, p.coords.latitude]);
                }
            },
            (err) => {
                console.log('位置監視錯誤:', err);
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 30000
            }
        );
    }

    async function getWeatherAtLocation(coord) {
        try {
            const lat = coord[1];
            const lon = coord[0];
            setInfo('取得天氣資料...');
            const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&timezone=auto`;
            const res = await fetch(url);
            if (!res.ok) throw new Error('Weather API error');
            const data = await res.json();
            if (data && data.current_weather) {
                const w = data.current_weather;
                const windDir = w.winddirection || 0;
                const windSpeed = w.windspeed || 0;
                const windDirection = (deg => {
                    const dirs = ['N','NE','E','SE','S','SW','W','NW'];
                    return dirs[Math.round(((deg %= 360) < 0 ? deg + 360 : deg) / 45) % 8];
                })(windDir);
                drawWindDirection({ lng: lon, lat: lat }, windDir, windSpeed, windDirection);
                setInfo(`風向 ${windDirection} (${Math.round(windDir)}°)，風速 ${windSpeed} km/h`);
            } else {
                setInfo('無法取得天氣資訊');
            }
        } catch (e) {
            console.error('getWeatherAtLocation error', e);
            setInfo('天氣資訊獲取失敗');
        }
    }

    async function findCourses() {
        setInfo("🔍 搜尋附近球場...");
        courseMarkers.forEach(m => m.remove());
        courseMarkers = [];
        const b = map.getBounds();
        const bbox = `${b.getSouth()},${b.getWest()},${b.getNorth()},${b.getEast()}`;
        const query = `[out:json];(nwr["leisure"="golf_course"](${bbox});nwr["golf"="clubhouse"](${bbox}););out center;`;
        try {
            const res = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`);
            const data = await res.json();
            data.elements.forEach(el => {
                const lat = el.lat || (el.center ? el.center.lat : null);
                const lon = el.lon || (el.center ? el.center.lon : null);
                if (lat && lon && el.tags && el.tags.name) {
                    const div = document.createElement('div');
                    div.className = 'map-label';
                    div.innerHTML = `⛳ ${el.tags.name}`;
                    div.onclick = () => {
                        map.flyTo({ center: [lon, lat], zoom: 18, pitch: 45 });
                        setTimeout(scanFacilities, 1000);
                    };
                    const m = new maplibregl.Marker({ element: div }).setLngLat([lon, lat]).addTo(map);
                    courseMarkers.push(m);
                }
            });
            setInfo(`發現 ${data.elements.length} 個球場`);
        } catch (e) { setInfo("連線逾時"); }
    }

    async function scanFacilities() {
        setInfo("🌿 疊加地形數據...");
        const b = map.getBounds();
        const bbox = `${b.getSouth()},${b.getWest()},${b.getNorth()},${b.getEast()}`;
        const query = `[out:json];(nwr["golf"](${bbox});nwr["natural"="water"](${bbox}););out geom;`;
        try {
            const res = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`);
            const data = await res.json();
            allElements = data.elements;
            holePositions = {};
            allElements.forEach(el => {
                if (el.tags && el.tags['golf:hole_number']) {
                    const holeNum = el.tags['golf:hole_number'];
                    if (el.geometry && el.geometry.length > 0) {
                        const center = el.geometry[Math.floor(el.geometry.length / 2)];
                        holePositions[holeNum] = [center.lon, center.lat];
                    }
                }
            });
            renderFeatures();
            setInfo(`設施已同步 (3D) - 發現 ${Object.keys(holePositions).length} 個洞`);
        } catch (e) { setInfo("掃描失敗"); }
    }

    function renderFeatures() {
        if (!allElements.length) return;
        const holeNum = document.getElementById('hole-select').value;
        const features = allElements.filter(el => {
            if (holeNum === 'all') return true;
            const ref = el.tags ? (el.tags.ref || el.tags['golf:hole_number']) : null;
            return ref === holeNum;
        }).map(el => {
            let type = el.tags ? (el.tags.golf || el.tags.natural || 'other') : 'other';
            return {
                type: "Feature", properties: { type: type },
                geometry: el.type === 'way' && el.geometry ? { type: "Polygon", coordinates: [el.geometry.map(g => [g.lon, g.lat])] } : null
            };
        }).filter(f => f.geometry);

        if (map.getLayer('golf-layer')) map.removeLayer('golf-layer');
        if (map.getSource('golf-src')) map.removeSource('golf-src');
        map.addSource('golf-src', { type: 'geojson', data: { type: 'FeatureCollection', features: features } });
        map.addLayer({
            id: 'golf-layer', type: 'fill', source: 'golf-src',
            paint: {
                'fill-color': ['match', ['get', 'type'],
                    'green', '#00ff00', 'bunker', '#f4ff81', 'fairway', '#76ff03', 'water', '#00b0ff', '#ffffff'],
                'fill-opacity': 0.25
            }
        });
    }

    function toggleMeasureMode() {
        isMeasureMode = !isMeasureMode;
        const status = document.getElementById('status-title');
        if (isMeasureMode) {
            if (status) status.innerText = '測距功能開啟';
            setInfo('請於地圖上點選兩個點以測量距離');
            clearMeasure();
        } else {
            if (status) status.innerText = '測距功能關閉';
            setInfo('支援深層縮放無視覺斷層');
            clearMeasure();
        }
    }

    function drawWindDirection(pos, windDir, windSpeed, windDirection) {
        if (windMarker) windMarker.remove();

        const arrowSize = Math.min(50, Math.max(30, windSpeed * 2));
        const svg = `
            <svg width="80" height="80" viewBox="0 0 80 80" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));">
                <circle cx="40" cy="40" r="35" fill="rgba(255, 152, 0, 0.8)" stroke="#fff" stroke-width="2"/>
                <g transform="translate(40, 40) rotate(${windDir})">
                    <line x1="0" y1="-25" x2="0" y2="15" stroke="#fff" stroke-width="3" stroke-linecap="round"/>
                    <polygon points="0,-25 -6,-10 6,-10" fill="#fff"/>
                </g>
                <circle cx="40" cy="40" r="4" fill="#fff"/>
                <text x="40" y="65" font-size="12" font-weight="bold" fill="#fff" text-anchor="middle">${windSpeed} km/h</text>
            </svg>
        `;

        const el = document.createElement('div');
        el.innerHTML = svg;
        el.style.cursor = 'pointer';
        el.title = `風向: ${windDirection}`;

        windMarker = new maplibregl.Marker({ element: el }).setLngLat(pos).addTo(map);
    }

    function clearMeasure() {
        try {
            measureMarkers.forEach(m => { try { m.remove(); } catch(e){} });
            measureMarkers = [];
            measurePoints = [];
            if (map && map.getLayer && map.getLayer('measure-line')) {
                try { map.removeLayer('measure-line'); } catch(e){}
            }
            if (map && map.getSource && map.getSource('measure-src')) {
                try { map.removeSource('measure-src'); } catch(e){}
            }
            const out = document.getElementById('dist-out');
            if (out) out.innerText = '--';
            setInfo('測距已清除');
        } catch(e) { console.error('clearMeasure error', e); }
    }

    function clearAll() {
        clearMeasure();
        if (windMarker) {
            windMarker.remove();
            windMarker = null;
        }
        setInfo("所有疊加已清除");
    }

    function shareLocation() {
        if (!userMarker) {
            setInfo("請先定位您的位置");
            return;
        }
        const pos = userMarker.getLngLat();
        // 修正原先 {} 大括號擺放與字串結構錯誤
        const url = `https://www.google.com/maps?q=${pos.lat},${pos.lng}`;
        navigator.clipboard.writeText(url).then(() => {
            setInfo("位置連結已複製到剪貼簿");
        }).catch(() => {
            setInfo(`分享連結: ${url}`);
        });
    }

    if (map) {
        map.on('click', (e) => {
            if (!isMeasureMode) return;
            if (measurePoints.length >= 2) clearMeasure();
            const coord = [e.lngLat.lng, e.lngLat.lat];
            measurePoints.push(coord);
            const m = new maplibregl.Marker({ color: measurePoints.length === 1 ? '#00e676' : '#ff1744' }).setLngLat(coord).addTo(map);
            measureMarkers.push(m);

            if (measurePoints.length === 2) {
                const dist = new maplibregl.LngLat(measurePoints[0][0], measurePoints[0][1]).distanceTo(new maplibregl.LngLat(measurePoints[1][0], measurePoints[1][1]));
                document.getElementById('dist-out').innerText = (dist * 1.09361).toFixed(0);

                // 補齊：在地圖上真正繪製測距軌跡線 (measure-line)
                map.addSource('measure-src', {
                    'type': 'geojson',
                    'data': {
                        'type': 'Feature',
                        'geometry': {
                            'type': 'LineString',
                            'coordinates': measurePoints
                        }
                    }
                });
                map.addLayer({
                    'id': 'measure-line',
                    'type': 'line',
                    'source': 'measure-src',
                    'layout': { 'line-join': 'round', 'line-cap': 'round' },
                    'paint': { 'line-color': '#ffeb3b', 'line-width': 4, 'line-dasharray': [2, 2] }
                });
            }
        });
    }
