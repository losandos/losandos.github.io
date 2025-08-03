// Initialize the map
const map = L.map('map').setView([51.505, -0.09], 13);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

// Initialize variables
console.log('Initial photoData:', photoData);
const photos = photoData || [];
console.log('Loaded photos:', photos);

// Sort photos by longitude (west to east) and latitude (south to north)
const sortedByLongitude = [...photos].sort((a, b) => a.longitude - b.longitude);
const sortedByLatitude = [...photos].sort((a, b) => a.latitude - b.latitude);

// Initialize DOM elements
const modal = document.getElementById('photo-modal');
const modalImg = document.getElementById('modal-image');
const modalInfo = document.getElementById('modal-info');
const modalContent = document.querySelector('.modal-content');
const closeBtn = document.querySelector('.close');

// Create navigation buttons
const prevBtn = document.createElement('button');
prevBtn.className = 'nav-button prev';
prevBtn.innerHTML = '&larr;';
prevBtn.setAttribute('aria-label', 'Previous photo');

const nextBtn = document.createElement('button');
nextBtn.className = 'nav-button next';
nextBtn.innerHTML = '&rarr;';
nextBtn.setAttribute('aria-label', 'Next photo');

const northBtn = document.createElement('button');
northBtn.className = 'nav-button north';
northBtn.innerHTML = '&uarr;';
northBtn.setAttribute('aria-label', 'North photo');

const southBtn = document.createElement('button');
southBtn.className = 'nav-button south';
southBtn.innerHTML = '&darr;';
southBtn.setAttribute('aria-label', 'South photo');

// Create toggle buttons
const navModeBtn = document.createElement('button');
navModeBtn.className = 'nav-mode-toggle directional';
navModeBtn.innerHTML = '↕️';
navModeBtn.setAttribute('aria-label', 'Currently in directional mode (north/south relative to current view)');

const viewToggleBtn = document.createElement('button');
viewToggleBtn.className = 'view-toggle';
viewToggleBtn.innerHTML = '⤡';
viewToggleBtn.setAttribute('aria-label', 'Toggle view size');

// Add all buttons to modal in the correct order
modalContent.appendChild(prevBtn);
modalContent.appendChild(nextBtn);
modalContent.appendChild(northBtn);
modalContent.appendChild(southBtn);
modalContent.appendChild(navModeBtn);
modalContent.appendChild(viewToggleBtn);

// Initialize state variables
let isCompactMode = false;
// Change the initial state of directional mode to false
let isDirectionalMode = false;

// Update the country filter setup and add city filter
const countryFilter = document.createElement('select');
countryFilter.id = 'country-filter';
countryFilter.className = 'country-filter';

const cityFilter = document.createElement('select');
cityFilter.id = 'city-filter';
cityFilter.className = 'city-filter disabled'; // Start disabled

function organizePhotosByLocation() {
    // Create maps to store counts
    const countryStats = new Map();
    const cityStats = new Map();
    
    // Count photos per country and city
    photos.forEach(photo => {
        if (photo.location) {
            if (photo.location.country) {
                const country = photo.location.country;
                countryStats.set(country, (countryStats.get(country) || 0) + 1);
            }
            if (photo.location.city) {
                const city = photo.location.city;
                cityStats.set(city, (cityStats.get(city) || 0) + 1);
            }
        }
    });
    
    // Create country filter dropdown with counts
    countryFilter.innerHTML = `
        <option value="">All Countries (${photos.length} photos)</option>
        ${Array.from(countryStats)
            .sort(([countryA], [countryB]) => countryA.localeCompare(countryB))
            .map(([country, count]) => 
                `<option value="${country}">${country} (${count} photo${count !== 1 ? 's' : ''})</option>`
            ).join('')}
    `;

    // Add the filters to the page
    const headerContent = document.querySelector('.header-content');
    const filterContainer = document.createElement('div');
    filterContainer.className = 'filter-section';
    
    // Create a wrapper for filters to stack them vertically
    const filtersWrapper = document.createElement('div');
    filtersWrapper.className = 'filters-wrapper';
    
    // Create country filter group
    const countryGroup = document.createElement('div');
    countryGroup.className = 'filter-group';
    const countryLabel = document.createElement('label');
    countryLabel.htmlFor = 'country-filter';
    countryLabel.textContent = 'Country';
    countryGroup.appendChild(countryLabel);
    countryGroup.appendChild(countryFilter);
    
    // Create city filter group
    const cityGroup = document.createElement('div');
    cityGroup.className = 'filter-group';
    const cityLabel = document.createElement('label');
    cityLabel.htmlFor = 'city-filter';
    cityLabel.textContent = 'City';
    cityLabel.className = 'city-label disabled';
    cityGroup.appendChild(cityLabel);
    cityGroup.appendChild(cityFilter);
    
    // Add filters to wrapper
    filtersWrapper.appendChild(countryGroup);
    filtersWrapper.appendChild(cityGroup);
    
    // Add wrapper to container
    filterContainer.appendChild(filtersWrapper);
    
    // Add container to header
    headerContent.appendChild(filterContainer);

    // Update city filter when country changes
    countryFilter.addEventListener('change', (e) => {
        const selectedCountry = e.target.value;
        updateCityFilter(selectedCountry);
        updateMapMarkers(selectedCountry, '');
    });

    // Add city filter change handler
    cityFilter.addEventListener('change', (e) => {
        const selectedCountry = countryFilter.value;
        const selectedCity = e.target.value;
        updateMapMarkers(selectedCountry, selectedCity);
    });
}

function updateCityFilter(selectedCountry) {
    // Get cities for selected country
    const citiesInCountry = new Map();
    
    photos.forEach(photo => {
        if (photo.location && 
            photo.location.country === selectedCountry && 
            photo.location.city) {
            const city = photo.location.city;
            citiesInCountry.set(city, (citiesInCountry.get(city) || 0) + 1);
        }
    });

    // Update city filter UI state
    const cityLabel = document.querySelector('.city-label');
    if (selectedCountry) {
        cityFilter.classList.remove('disabled');
        cityLabel.classList.remove('disabled');
        
        // Update city options
        cityFilter.innerHTML = `
            <option value="">All Cities (${photos.filter(p => p.location && p.location.country === selectedCountry).length} photos)</option>
            ${Array.from(citiesInCountry)
                .sort(([cityA], [cityB]) => cityA.localeCompare(cityB))
                .map(([city, count]) => 
                    `<option value="${city}">${city} (${count} photo${count !== 1 ? 's' : ''})</option>`
                ).join('')}
        `;
        cityFilter.disabled = false;
    } else {
        cityFilter.classList.add('disabled');
        cityLabel.classList.add('disabled');
        cityFilter.innerHTML = '<option value="">Select Country First</option>';
        cityFilter.disabled = true;
    }
}

// Add a variable to track the currently highlighted marker
let highlightedMarker = null;

// Modify createPhotoIcon to accept an isHighlighted parameter
function createPhotoIcon(photoUrl, isHighlighted = false) {
    return L.divIcon({
        html: `<div class="photo-marker ${isHighlighted ? 'highlighted' : ''}" style="width: 40px; height: 40px; border-radius: 50%; overflow: hidden; border: 2px solid white; box-shadow: ${isHighlighted ? '0 0 15px 5px rgba(0,128,255,0.6)' : '0 2px 4px rgba(0,0,0,0.3)'};">
                <img src="${photoUrl}" style="width: 100%; height: 100%; object-fit: cover;">
               </div>`,
        className: '',
        iconSize: [40, 40],
        iconAnchor: [20, 20]
    });
}

// Update the marker highlighting
function updateMarkerHighlight(photo) {
    if (highlightedMarker) {
        // Reset previous highlighted marker
        const prevMarker = activeMarkers.find(m => m.photo === highlightedMarker.photo);
        if (prevMarker) {
            prevMarker.setIcon(createPhotoIcon(prevMarker.photo.thumbnail));
        }
    }
    
    // Highlight new marker
    const newMarker = activeMarkers.find(m => m.photo === photo);
    if (newMarker) {
        newMarker.setIcon(createPhotoIcon(photo.thumbnail, true));
        highlightedMarker = newMarker;
    }
}

// Store active markers
let activeMarkers = [];

// Modify addPhotoMarkers to store photo reference
function addPhotoMarkers(photosToShow = photos) {
    console.log('Adding markers for photos:', photosToShow);
    
    // Clear existing markers
    activeMarkers.forEach(marker => map.removeLayer(marker));
    activeMarkers = [];

    photosToShow.forEach((photo, index) => {
        if (photo.latitude && photo.longitude) {
            const marker = L.marker([photo.latitude, photo.longitude], {
                icon: createPhotoIcon(photo.thumbnail)
            })
                .addTo(map)
                .on('click', () => showPhotoModal(photos.indexOf(photo)));
            
            marker.photo = photo; // Store photo reference on marker
            activeMarkers.push(marker);
        }
    });

    // Fit bounds if there are markers
    if (activeMarkers.length > 0) {
        const bounds = L.latLngBounds(photosToShow.map(photo => [photo.latitude, photo.longitude]));
        map.fitBounds(bounds);
    }
}

// Update map markers based on country and city filters
function updateMapMarkers(selectedCountry = '', selectedCity = '') {
    const filteredPhotos = photos.filter(photo => {
        if (!photo.location) return false;
        
        const countryMatch = !selectedCountry || photo.location.country === selectedCountry;
        const cityMatch = !selectedCity || photo.location.city === selectedCity;
        
        return countryMatch && cityMatch;
    });

    addPhotoMarkers(filteredPhotos);
}

// Initialize the map with photos
if (photos.length > 0) {
    console.log('Starting map initialization with', photos.length, 'photos');
    organizePhotosByLocation(); // Renamed from organizePhotosByCountry
    addPhotoMarkers();
} else {
    console.log('No photos found');
}

// Update the map move/zoom event handler to properly refresh directional navigation
map.on('moveend', () => {
    if (modal.style.display === 'block') {
        const currentPhoto = photos[parseInt(modal.dataset.currentIndex)];
        if (currentPhoto) {
            updateNavigationVisibility(currentPhoto);
        }
    }
});

// Add a constant for the zoom level when showing photos
const PHOTO_ZOOM_LEVEL = 13; // This gives a good regional view, adjust between 8-12 for different zoom levels

// Update showPhotoModal to handle the initial state
function showPhotoModal(index, keepCurrentMode = false) {
    const photo = photos[index];
    
    modalImg.src = photo.fullPath;
    
    // Create Google Maps link using coordinates
    const googleMapsLink = `https://www.google.com/maps?q=${photo.latitude},${photo.longitude}`;
    
    // Always zoom in absolute mode by default
    if (!keepCurrentMode) {
        map.flyTo([photo.latitude, photo.longitude], PHOTO_ZOOM_LEVEL, {
            duration: 1.5,
            easeLinearity: 0.25
        });
    } else {
        // For navigation, follow the current mode
        if (!isDirectionalMode) {
            map.flyTo([photo.latitude, photo.longitude], PHOTO_ZOOM_LEVEL, {
                duration: 1.5,
                easeLinearity: 0.25
            });
        } else if (!map.getBounds().contains([photo.latitude, photo.longitude])) {
            map.panTo([photo.latitude, photo.longitude], {
                animate: true,
                duration: 0.5
            });
        }
    }
    
    // Format location information
    let locationInfo = '';
    let addressInfo = '';
    if (photo.location) {
        // Compact Google Maps link at the very top
        const googleMapsLink = `https://www.google.com/maps?q=${photo.latitude},${photo.longitude}`;
        locationInfo = `
            <div class="maps-link">
                <a href="${googleMapsLink}" target="_blank" title="Open in Google Maps">
                    <span class="maps-label">View on Google Maps</span>
                </a>
            </div>`;
        
        // Location details in the middle
        if (photo.location.city) {
            locationInfo += `<p class="location-city"><strong>City</strong> ${photo.location.city}</p>`;
        }
        
        if (photo.location.country) {
            locationInfo += `<p class="location-country"><strong>Country</strong> ${photo.location.country}`;
            if (photo.location.state) {
                locationInfo += ` (${photo.location.state})`;
            }
            locationInfo += '</p>';
        }

        // Full address at the bottom
        addressInfo = `
            <div class="location-address">
                <span class="address-text">${photo.location.displayName}</span>
            </div>`;
    } else {
        // Fallback to coordinates
        const googleMapsLink = `https://www.google.com/maps?q=${photo.latitude},${photo.longitude}`;
        locationInfo = `
            <div class="maps-link">
                <a href="${googleMapsLink}" target="_blank" title="Open in Google Maps">
                    <span class="maps-label">View on Google Maps</span>
                </a>
            </div>`;
        
        addressInfo = `
            <div class="location-address">
                <span class="address-text">${photo.latitude.toFixed(6)}, ${photo.longitude.toFixed(6)}</span>
            </div>`;
    }

    modalInfo.innerHTML = `
        ${locationInfo}
        <p class="photo-date"><strong>Date</strong> ${photo.date}</p>
        ${photo.description ? `<p class="photo-description"><strong>Description</strong> ${photo.description}</p>` : ''}
        ${addressInfo}
    `;
    
    // Update marker highlight
    updateMarkerHighlight(photo);
    
    // Update navigation visibility
    updateNavigationVisibility(photo);
    
    // Store indices for navigation
    const longitudeIndex = sortedByLongitude.findIndex(p => p.fullPath === photo.fullPath);
    const latitudeIndex = sortedByLatitude.findIndex(p => p.fullPath === photo.fullPath);
    modal.dataset.currentIndex = index;
    modal.dataset.longitudeIndex = longitudeIndex;
    modal.dataset.latitudeIndex = latitudeIndex;
    
    modal.style.display = 'block';
    
    // Only set compact mode if this is a new modal (not navigation)
    if (!keepCurrentMode) {
        isCompactMode = true;
        modal.classList.add('compact');
        viewToggleBtn.innerHTML = '⤢';
    }
    
    setTimeout(() => {
        modal.classList.add('show');
        // Update navigation visibility after transition
        updateNavigationVisibility(photo);
    }, 10);
}

// Update navigation function to handle directional mode for all directions
function navigateToPhoto(direction) {
    const currentLongIndex = parseInt(modal.dataset.longitudeIndex);
    const currentLatIndex = parseInt(modal.dataset.latitudeIndex);
    const currentPhoto = photos[parseInt(modal.dataset.currentIndex)];
    let newPhoto;
    
    if (isDirectionalMode) {
        const bounds = map.getBounds();
        const POSITION_THRESHOLD = 0.1; // Threshold for both latitude and longitude
        
        // Find photos within current view
        const visiblePhotos = photos.filter(p => 
            bounds.contains([p.latitude, p.longitude]) && // Photo is in view
            p.fullPath !== currentPhoto.fullPath // Not the current photo
        );
        
        switch(direction) {
            case 'next': // east
                newPhoto = visiblePhotos
                    .filter(p => 
                        p.longitude > currentPhoto.longitude && // East of current photo
                        Math.abs(p.latitude - currentPhoto.latitude) < POSITION_THRESHOLD // Within latitude threshold
                    )
                    .sort((a, b) => a.longitude - b.longitude)[0]; // Get the closest one
                break;
            case 'prev': // west
                newPhoto = visiblePhotos
                    .filter(p => 
                        p.longitude < currentPhoto.longitude && // West of current photo
                        Math.abs(p.latitude - currentPhoto.latitude) < POSITION_THRESHOLD // Within latitude threshold
                    )
                    .sort((a, b) => b.longitude - a.longitude)[0]; // Get the closest one
                break;
            case 'north':
                newPhoto = visiblePhotos
                    .filter(p => 
                        p.latitude > currentPhoto.latitude && // North of current photo
                        Math.abs(p.longitude - currentPhoto.longitude) < POSITION_THRESHOLD // Within longitude threshold
                    )
                    .sort((a, b) => a.latitude - b.latitude)[0]; // Get the closest one
                break;
            case 'south':
                newPhoto = visiblePhotos
                    .filter(p => 
                        p.latitude < currentPhoto.latitude && // South of current photo
                        Math.abs(p.longitude - currentPhoto.longitude) < POSITION_THRESHOLD // Within longitude threshold
                    )
                    .sort((a, b) => b.latitude - a.latitude)[0]; // Get the closest one
                break;
        }
    } else {
        // Absolute mode (unchanged)
        switch(direction) {
            case 'next':
                newPhoto = sortedByLongitude[currentLongIndex + 1];
                break;
            case 'prev':
                newPhoto = sortedByLongitude[currentLongIndex - 1];
                break;
            case 'north':
                newPhoto = sortedByLatitude[currentLatIndex + 1];
                break;
            case 'south':
                newPhoto = sortedByLatitude[currentLatIndex - 1];
                break;
        }
    }
    
    if (newPhoto) {
        const newIndex = photos.findIndex(p => p.fullPath === newPhoto.fullPath);
        showPhotoModal(newIndex, true); // Pass true to keep current mode
    }
}

// Add click handlers for buttons
northBtn.onclick = () => navigateToPhoto('north');
southBtn.onclick = () => navigateToPhoto('south');
prevBtn.onclick = () => navigateToPhoto('prev');
nextBtn.onclick = () => navigateToPhoto('next');

// Add toggle functionality
viewToggleBtn.onclick = (e) => {
    e.stopPropagation();
    isCompactMode = !isCompactMode;
    modal.classList.toggle('compact', isCompactMode);
    viewToggleBtn.innerHTML = isCompactMode ? '⤢' : '⤡';
    
    if (isCompactMode) {
        const currentPhoto = photos[parseInt(modal.dataset.currentIndex)];
        map.flyTo([currentPhoto.latitude, currentPhoto.longitude], PHOTO_ZOOM_LEVEL - 1);
    }
};

// Update the toggle button appearance
navModeBtn.innerHTML = 'Navigate in the World'; // Change to text
navModeBtn.setAttribute('aria-label', 'Currently in absolute mode (navigate through all photos)');

// Update the toggle functionality
navModeBtn.onclick = (e) => {
    e.stopPropagation();
    isDirectionalMode = !isDirectionalMode;
    navModeBtn.classList.toggle('directional', isDirectionalMode);
    
    // Update the button text and tooltip
    if (isDirectionalMode) {
        navModeBtn.innerHTML = 'Navigate in current view';
        navModeBtn.setAttribute('aria-label', 'Currently in directional mode (navigate within visible area)');
    } else {
        navModeBtn.innerHTML = 'Navigate in the World';
        navModeBtn.setAttribute('aria-label', 'Currently in absolute mode (navigate through all photos)');
    }
    
    // Update the current photo's display
    const currentPhoto = photos[parseInt(modal.dataset.currentIndex)];
    if (currentPhoto) {
        if (!isDirectionalMode) {
            map.flyTo([currentPhoto.latitude, currentPhoto.longitude], PHOTO_ZOOM_LEVEL);
        }
        updateNavigationVisibility(currentPhoto);
    }
};

// Update the navigation visibility function
function updateNavigationVisibility(photo) {
    if (isDirectionalMode) {
        const bounds = map.getBounds();
        const POSITION_THRESHOLD = 0.1;
        
        // Get all visible photos except the current one
        const visiblePhotos = photos.filter(p => 
            bounds.contains([p.latitude, p.longitude]) && 
            p.fullPath !== photo.fullPath
        );

        // Check for photos in each direction within threshold
        const hasEastPhoto = visiblePhotos.some(p => 
            p.longitude > photo.longitude && 
            Math.abs(p.latitude - photo.latitude) < POSITION_THRESHOLD
        );
        const hasWestPhoto = visiblePhotos.some(p => 
            p.longitude < photo.longitude && 
            Math.abs(p.latitude - photo.latitude) < POSITION_THRESHOLD
        );
        const hasNorthPhoto = visiblePhotos.some(p => 
            p.latitude > photo.latitude && 
            Math.abs(p.longitude - photo.longitude) < POSITION_THRESHOLD
        );
        const hasSouthPhoto = visiblePhotos.some(p => 
            p.latitude < photo.latitude && 
            Math.abs(p.longitude - photo.longitude) < POSITION_THRESHOLD
        );

        console.log('Directional checks:', {
            hasEastPhoto,
            hasWestPhoto,
            hasNorthPhoto,
            hasSouthPhoto
        });

        // Force visibility with !important to override any CSS
        prevBtn.setAttribute('style', `display: ${hasWestPhoto ? 'flex' : 'none'} !important`);
        nextBtn.setAttribute('style', `display: ${hasEastPhoto ? 'flex' : 'none'} !important`);
        northBtn.setAttribute('style', `display: ${hasNorthPhoto ? 'flex' : 'none'} !important`);
        southBtn.setAttribute('style', `display: ${hasSouthPhoto ? 'flex' : 'none'} !important`);
        
        // Remove any hidden classes
        [nextBtn, prevBtn, northBtn, southBtn].forEach(btn => {
            btn.classList.remove('hidden');
        });

        console.log('Button display states:', {
            prev: prevBtn.style.display,
            next: nextBtn.style.display,
            north: northBtn.style.display,
            south: southBtn.style.display
        });
    } else {
        // Absolute mode
        console.log('In absolute mode');
        
        // Reset display style
        [nextBtn, prevBtn, northBtn, southBtn].forEach(btn => {
            btn.setAttribute('style', 'display: flex !important');
        });
        
        const longitudeIndex = sortedByLongitude.findIndex(p => p.fullPath === photo.fullPath);
        const latitudeIndex = sortedByLatitude.findIndex(p => p.fullPath === photo.fullPath);
        
        prevBtn.classList.toggle('hidden', longitudeIndex === 0);
        nextBtn.classList.toggle('hidden', longitudeIndex === sortedByLongitude.length - 1);
        northBtn.classList.toggle('hidden', latitudeIndex === sortedByLatitude.length - 1);
        southBtn.classList.toggle('hidden', latitudeIndex === 0);
    }
}

// Add this function near other modal-related functions
function checkPhotoVisibilityAndCloseModal() {
    if (modal.style.display === 'block' && isCompactMode) {
        const currentPhoto = photos[parseInt(modal.dataset.currentIndex)];
        const bounds = map.getBounds();
        
        if (currentPhoto && !bounds.contains([currentPhoto.latitude, currentPhoto.longitude])) {
            // Photo is no longer in view, close the modal
            closeBtn.onclick();
        }
    }
}

// Add map event listeners to update navigation when the map changes
map.on('moveend zoomend', () => {
    if (modal.style.display === 'block') {
        const currentPhoto = photos[parseInt(modal.dataset.currentIndex)];
        if (currentPhoto) {
            updateNavigationVisibility(currentPhoto);
            checkPhotoVisibilityAndCloseModal();
        }
    }
});

// Modal event listeners
closeBtn.onclick = () => {
    modal.classList.remove('show');
    setTimeout(() => {
        modal.style.display = 'none';
        isCompactMode = false;
        modal.classList.remove('compact');
        viewToggleBtn.innerHTML = '⤡';
    }, 500); // Changed from 300 to 800 to match the CSS transition
};

modal.onclick = (e) => {
    if (e.target === modal && !isCompactMode) {
        closeBtn.onclick();
    }
};

// Update keyboard navigation
document.addEventListener('keydown', (e) => {
    if (modal.style.display === 'block') {
        if (e.key === 'ArrowLeft' && !prevBtn.classList.contains('hidden')) {
            navigateToPhoto('prev');
        } else if (e.key === 'ArrowRight' && !nextBtn.classList.contains('hidden')) {
            navigateToPhoto('next');
        } else if (e.key === 'ArrowUp' && !northBtn.classList.contains('hidden')) {
            navigateToPhoto('north');
        } else if (e.key === 'ArrowDown' && !southBtn.classList.contains('hidden')) {
            navigateToPhoto('south');
        } else if (e.key === 'Escape') {
            closeBtn.onclick();
        }
    }
}); 