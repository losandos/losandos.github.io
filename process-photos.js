import fs from 'fs';
import path from 'path';
import ExifReader from 'exifreader';
import fetch from 'node-fetch';
import sharp from 'sharp';
import { fileURLToPath } from 'url';

// Get directory name in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PHOTOS_DIR = './photos';
const THUMBNAILS_DIR = './public/thumbnails';
const OUTPUT_FILE = './public/js/photoData.js';
// Reduce concurrent requests to be more gentle with the API
const CONCURRENT_REQUESTS = 5; // Reduced from 10 to 5
const THUMBNAIL_WIDTH = 400; // Width for thumbnails, height will be calculated to maintain aspect ratio

// Create thumbnails directory if it doesn't exist
if (!fs.existsSync(THUMBNAILS_DIR)) {
    fs.mkdirSync(THUMBNAILS_DIR, { recursive: true });
}

// Convert GPS coordinates from EXIF format to decimal degrees
function convertToDecimalDegrees(gpsValue, ref) {
    // GPS values come as rationals [numerator, denominator]
    const degrees = gpsValue[0][0] / gpsValue[0][1];
    const minutes = gpsValue[1][0] / gpsValue[1][1];
    const seconds = gpsValue[2][0] / gpsValue[2][1];
    
    let decimal = degrees + (minutes / 60) + (seconds / 3600);
    
    // Make negative for South or West
    if (ref && (ref[0] === 'S' || ref[0] === 'W')) {
        decimal = -decimal;
    }
    
    return Number(decimal.toFixed(6)); // Keep 6 decimal places
}

function formatDate(dateStr) {
    const [datePart, timePart] = dateStr.split(' ');
    const [year, month, day] = datePart.split(':');
    
    const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];
    
    const monthName = months[parseInt(month) - 1];
    return `${monthName} ${parseInt(day)}, ${year} - ${timePart}`;
}

// Create thumbnail for a photo
async function createThumbnail(filePath, fileName) {
    const outputPath = path.join(THUMBNAILS_DIR, fileName);
    
    try {
        await sharp(filePath)
            .resize(THUMBNAIL_WIDTH, null, {
                fit: 'inside',
                withoutEnlargement: true
            })
            .jpeg({
                quality: 80,
                progressive: true
            })
            .toFile(outputPath);
            
        return `./thumbnails/${fileName}`;
    } catch (error) {
        console.error(`Error creating thumbnail for ${fileName}:`, error);
        return null;
    }
}

async function getLocationDetails(latitude, longitude) {
    try {
        // Add retry logic
        const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`,
            {
                headers: {
                    'User-Agent': 'FunMap/1.0' // Good practice to identify your application
                }
            }
        );
        
        if (!response.ok) {
            throw new Error('Failed to fetch location data');
        }
        
        const data = await response.json();
        
        return {
            country: data.address.country || '',
            state: data.address.state || data.address.region || '',
            city: data.address.city || data.address.town || data.address.village || '',
            road: data.address.road || '',
            displayName: data.display_name || ''
        };
    } catch (error) {
        console.error('Error fetching location details:', error);
        return {
            country: '',
            state: '',
            city: '',
            road: '',
            displayName: ''
        };
    }
}

// Initialize the output file with an empty array
function initializeOutputFile() {
    const jsDir = path.dirname(OUTPUT_FILE);
    if (!fs.existsSync(jsDir)) {
        console.log(`Creating directory: ${jsDir}`);
        fs.mkdirSync(jsDir, { recursive: true });
    }
    fs.writeFileSync(OUTPUT_FILE, 'const photoData = [];\n');
}

// Append a single photo to the output file
function appendPhotoData(photo) {
    // Read the current file content
    let content = fs.readFileSync(OUTPUT_FILE, 'utf8');
    
    // Extract the current array
    let currentData = [];
    try {
        // Extract array content between [ and ]
        const match = content.match(/photoData = (\[[\s\S]*\]);/);
        if (match) {
            // Parse the existing array
            currentData = JSON.parse(match[1]);
        }
    } catch (error) {
        console.error('Error parsing existing data:', error);
        // If there's an error, assume empty array (failsafe)
        currentData = [];
    }
    
    // Add the new photo
    currentData.push(photo);
    
    // Write the complete file with the updated array
    const newContent = `const photoData = ${JSON.stringify(currentData, null, 2)};`;
    fs.writeFileSync(OUTPUT_FILE, newContent);
}

// Process a single photo
async function processPhoto(file) {
    console.log(`Processing file: ${file}`);
    if (!['.jpg', '.jpeg'].includes(path.extname(file).toLowerCase())) {
        console.log(`Skipping ${file} - not a JPEG file`);
        return null;
    }

    const filePath = path.join(PHOTOS_DIR, file);
    const buffer = fs.readFileSync(filePath);
    
    try {
        // First create the thumbnail
        console.log(`Creating thumbnail for ${file}`);
        const thumbnailPath = await createThumbnail(filePath, file);
        
        if (!thumbnailPath) {
            console.error(`Failed to create thumbnail for ${file}`);
            return null;
        }

        console.log(`Extracting EXIF data from ${file}`);
        const tags = await ExifReader.load(buffer);

        if (tags.GPSLatitude && tags.GPSLongitude) {
            console.log('Found GPS data:', {
                lat: tags.GPSLatitude.value,
                latRef: tags.GPSLatitudeRef?.value,
                long: tags.GPSLongitude.value,
                longRef: tags.GPSLongitudeRef?.value
            });

            const latitude = convertToDecimalDegrees(
                tags.GPSLatitude.value,
                tags.GPSLatitudeRef?.value
            );

            const longitude = convertToDecimalDegrees(
                tags.GPSLongitude.value,
                tags.GPSLongitudeRef?.value
            );

            const date = tags.DateTimeOriginal 
                ? formatDate(tags.DateTimeOriginal.description)
                : 'Unknown';

            // Get location details
            console.log(`Fetching location details for ${file}`);
            const locationDetails = await getLocationDetails(latitude, longitude);

            // Instead of returning the photo data, append it immediately
            if (latitude && longitude) {
                const photoData = {
                    fullPath: `../photos/${file}`,
                    thumbnail: thumbnailPath,
                    latitude,
                    longitude,
                    date,
                    description: '',
                    location: locationDetails
                };
                
                appendPhotoData(photoData);
                console.log(`Appended data for ${file}`);
                return true; // Return true to indicate success
            }
        } else {
            console.log(`No GPS data found in ${file}`);
            // Clean up thumbnail if no GPS data
            const thumbnailFile = path.join(THUMBNAILS_DIR, file);
            if (fs.existsSync(thumbnailFile)) {
                fs.unlinkSync(thumbnailFile);
            }
            return null;
        }
    } catch (error) {
        console.error(`Error processing ${file}:`, error.message);
        // Clean up thumbnail if there was an error
        const thumbnailFile = path.join(THUMBNAILS_DIR, file);
        if (fs.existsSync(thumbnailFile)) {
            fs.unlinkSync(thumbnailFile);
        }
        return null;
    }
}

// Process photos in batches
async function processBatch(files, startIndex, batchSize) {
    const batch = files.slice(startIndex, startIndex + batchSize);
    const promises = batch.map(file => processPhoto(file));
    const results = await Promise.all(promises);
    return results.filter(result => result === true).length; // Return count of successful processes
}

// Main processing function
async function processPhotos() {
    console.log('Starting photo processing...');
    const files = fs.readdirSync(PHOTOS_DIR);
    console.log(`Found ${files.length} files in photos directory`);

    // Initialize the output file
    initializeOutputFile();
    
    let processedCount = 0;
    
    // Process files in batches
    for (let i = 0; i < files.length; i += CONCURRENT_REQUESTS) {
        console.log(`Processing batch starting at index ${i}`);
        const batchSuccessCount = await processBatch(files, i, CONCURRENT_REQUESTS);
        processedCount += batchSuccessCount;
        
        // Add delay between batches to respect rate limits
        if (i + CONCURRENT_REQUESTS < files.length) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }

    console.log(`Processed ${processedCount} photos with GPS data`);
    console.log(`Data written to ${OUTPUT_FILE}`);
}

// Run the main function
processPhotos()
    .catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    }); 