# FunMap

A simple static website that displays your photos on an OpenStreetMap based on their GPS coordinates. Perfect for visualizing your photo collection on a map!

## Features
- Displays photos on an interactive OpenStreetMap
- Shows photo information when clicked
- Extracts GPS data from EXIF metadata
- Responsive design
- Mobile-friendly interface

## Setup
1. Place your photos in the `photos` directory
2. Run `npm install` to install dependencies
3. Run `npm run process` to extract photo metadata
4. The website will be ready to view

## Deployment

### Local Development
1. After running the setup steps above, open `index.html` in your browser

### GitHub Pages Deployment
1. Fork or clone this repository
2. Add your photos to the `photos` directory
3. Run the setup steps above
4. Commit all changes:
   ```bash
   git add .
   git commit -m "Add my photos"
   ```
5. Push to GitHub:
   ```bash
   git push origin main
   ```
6. Go to your repository settings on GitHub
7. Under "Pages", select the main branch as source
8. Your site will be published at `https://[your-username].github.io/[repo-name]`

## Technologies Used
- Leaflet.js for map integration
- ExifReader for extracting photo metadata
- OpenStreetMap for map tiles
- Vanilla JavaScript

## License
This project is open source and available under the MIT License. 