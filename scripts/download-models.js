// scripts/download-models.js
const fs = require('fs');
const path = require('path');
const https = require('https');

const modelsDir = path.join(__dirname, '..', 'public', 'models');
const baseUrl = 'https://github.com/justadudewhohacks/face-api.js/raw/master/weights';

const modelFiles = [
    'tiny_face_detector_model-weights_manifest.json',
    'tiny_face_detector_model-shard1',
    'face_landmark_68_model-weights_manifest.json',
    'face_landmark_68_model-shard1',
    'face_recognition_model-weights_manifest.json',
    'face_recognition_model-shard1',
    'face_recognition_model-shard2',
    'face_expression_model-weights_manifest.json',
    'face_expression_model-shard1'
];

// Create models directory if it doesn't exist
if (!fs.existsSync(modelsDir)) {
    fs.mkdirSync(modelsDir, { recursive: true });
    console.log('Created models directory:', modelsDir);
}

function downloadFile(url, destination) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(destination);

        const request = https.get(url, (response) => {
            // Handle redirects
            if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                file.close();
                fs.unlink(destination, () => { });
                downloadFile(response.headers.location, destination).then(resolve).catch(reject);
                return;
            }

            if (response.statusCode === 200) {
                response.pipe(file);
                file.on('finish', () => {
                    file.close();
                    console.log(`✅ Downloaded: ${path.basename(destination)} (${getFileSize(destination)})`);
                    resolve();
                });
            } else {
                file.close();
                fs.unlink(destination, () => { });
                reject(new Error(`Failed to download ${url}: HTTP ${response.statusCode}`));
            }
        }).on('error', (err) => {
            file.close();
            fs.unlink(destination, () => { });
            reject(err);
        });

        // Set timeout
        request.setTimeout(30000, () => {
            request.abort();
            reject(new Error(`Download timeout: ${url}`));
        });
    });
}

function getFileSize(filePath) {
    try {
        const stats = fs.statSync(filePath);
        const bytes = stats.size;
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    } catch {
        return 'Unknown size';
    }
}

async function downloadAllModels() {
    console.log('🚀 Starting face-api.js models download...');
    console.log('📁 Target directory:', modelsDir);

    let downloaded = 0;
    let skipped = 0;
    let failed = 0;

    for (const fileName of modelFiles) {
        const url = `${baseUrl}/${fileName}`;
        const destination = path.join(modelsDir, fileName);

        // Skip if file already exists and has content
        if (fs.existsSync(destination)) {
            const stats = fs.statSync(destination);
            if (stats.size > 0) {
                console.log(`⏭️  Skipped (exists): ${fileName} (${getFileSize(destination)})`);
                skipped++;
                continue;
            }
        }

        try {
            console.log(`⬇️  Downloading: ${fileName}...`);
            await downloadFile(url, destination);
            downloaded++;

            // Verify file was downloaded and has content
            const stats = fs.statSync(destination);
            if (stats.size === 0) {
                throw new Error('Downloaded file is empty');
            }

        } catch (error) {
            console.error(`❌ Failed to download ${fileName}:`, error.message);
            failed++;

            // Clean up empty/failed file
            try {
                if (fs.existsSync(destination)) {
                    fs.unlinkSync(destination);
                }
            } catch { }
        }
    }

    console.log('\n📊 Download Summary:');
    console.log(`✅ Downloaded: ${downloaded} files`);
    console.log(`⏭️  Skipped: ${skipped} files`);
    console.log(`❌ Failed: ${failed} files`);

    if (failed === 0) {
        console.log('\n🎉 All models downloaded successfully!');
        console.log('📁 Models location:', modelsDir);
        console.log('\n🚀 You can now run: npm run dev');
    } else {
        console.log('\n⚠️  Some downloads failed. Please check your internet connection and try again.');
        process.exit(1);
    }
}

// Handle process termination
process.on('SIGINT', () => {
    console.log('\n\n⏹️  Download interrupted by user');
    process.exit(1);
});

process.on('uncaughtException', (error) => {
    console.error('\n❌ Unexpected error:', error.message);
    process.exit(1);
});

downloadAllModels().catch((error) => {
    console.error('❌ Download failed:', error.message);
    process.exit(1);
});