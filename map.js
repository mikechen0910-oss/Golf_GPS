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
                        "attribution": "Tiles 穢 Esri",
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
            setInfo('?啣?頛摰?');
        });

        window.addEventListener('resize', () => { try { if (map) map.resize(); } catch(e){} });
    } catch (e) {
        console.error('Map init error', e);
        setInfo('?啣????仃??' + (e && e.message ? e.message : e));
        const m = document.getElementById('map');
        if (m) m.innerHTML = '<div style="color:#fff; padding:20px; text-align:center;">?啣?頛憭望?嚗??亦??汗?冽?嗅 (Console) 隞亙?敺隤斤敦蝭??/div>';
    }

    function locateGPS() {
        setInfo("?儭?銵?摰?銝?..");

        if (!navigator.geolocation) {
            setInfo("?函??汗?其??舀?啁?摰?");
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
                        setInfo(`雿蔭撌脫??(撟喳? ${positions.length} 甈∟???`);
                        startPositionWatch();
                        setTimeout(() => getWeatherAtLocation([avgLng, avgLat]), 1500);
                    }
                },
                (err) => {
                    attempts++;
                    let errMsg = '';
                    if (err.code === 1) errMsg = '摰?鋡急?蝯?隢閮剖?銝剖?閮曹?蝵桀???;
                    else if (err.code === 2) errMsg = '?⊥???雿蔭鞈?';
                    else if (err.code === 3) errMsg = '摰??暹?嚗??券?????閰?;
                    else errMsg = err.message;

                    if (attempts < maxAttempts) {
                        setTimeout(getPosition, 1500);
                    } else {
                        setInfo(`摰?憭望? (${errMsg})`);
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
                console.log('雿蔭????航炊:', err);
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
            setInfo('??憭拇除鞈?...');
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
                setInfo(`憸典? ${windDirection} (${Math.round(windDir)}簞)嚗◢??${windSpeed} km/h`);
            } else {
                setInfo('?⊥???憭拇除鞈?');
            }
        } catch (e) {
            console.error('getWeatherAtLocation error', e);
            setInfo('憭拇除鞈??脣?憭望?');
        }
    }

    async function findCourses() {
        setInfo("?? ?????...");
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
                    div.innerHTML = `??${el.tags.name}`;
                    div.onclick = () => {
                        map.flyTo({ center: [lon, lat], zoom: 18, pitch: 45 });
                        setTimeout(scanFacilities, 1000);
                    };
                    const m = new maplibregl.Marker({ element: div }).setLngLat([lon, lat]).addTo(map);
                    courseMarkers.push(m);
                }
            });
            setInfo(`?潛 ${data.elements.length} ???循);
        } catch (e) { setInfo("????暹?"); }
    }

    async function scanFacilities() {
        setInfo("? ???啣耦?豢?...");
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
            setInfo(`閮剜撌脣?甇?(3D) - ?潛 ${Object.keys(holePositions).length} ??`);
        } catch (e) { setInfo("??憭望?"); }
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
            if (status) status.innerText = '皜祈????';
            setInfo('隢?啣?銝??詨??隞交葫????);
            clearMeasure();
        } else {
            if (status) status.innerText = '皜祈????';
            setInfo('?舀瘛勗惜蝮格?∟?閬箸撅?);
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
        el.title = `憸典?: ${windDirection}`;

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
            setInfo('皜祈?撌脫???);
        } catch(e) { console.error('clearMeasure error', e); }
    }

    function clearAll() {
        clearMeasure();
        if (windMarker) {
            windMarker.remove();
            windMarker = null;
        }
        setInfo("????歇皜");
    }

    function shareLocation() {
        if (!userMarker) {
            setInfo("隢?摰??函?雿蔭");
            return;
        }
        const pos = userMarker.getLngLat();
        // 靽格迤?? {} 憭扳??曇?摮葡蝯??航炊
        const url = `https://www.google.com/maps?q=${pos.lat},${pos.lng}`;
        navigator.clipboard.writeText(url).then(() => {
            setInfo("雿蔭???撌脰?鋆賢?芾票蝪?);
        }).catch(() => {
            setInfo(`?澈???: ${url}`);
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

                // 鋆?嚗?啣?銝?甇?鼓鋆賣葫頝?頝∠? (measure-line)
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
