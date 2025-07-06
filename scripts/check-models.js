// scripts/check-models.js
const fs = require('fs');
const path = require('path');

const modelsDir = path.join(__dirname, '..', 'public', 'models');

const requiredFiles = [
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
        return 'N/A';
    }
}

function checkModels() {
    console.log('🔍 Checking face-api.js model files...');
    console.log('📁 Models directory:', modelsDir);

    if (!fs.existsSync(modelsDir)) {
        console.log('❌ Models directory does not exist!');
        console.log('🚀 Run: npm run download-models');
        return false;
    }

    let allPresent = true;
    let totalSize = 0;

    console.log('\n📋 Model Files Status:');
    console.log('─'.repeat(80));

    for (const fileName of requiredFiles) {
        const filePath = path.join(modelsDir, fileName);
        const exists = fs.existsSync(filePath);

        if (exists) {
            const stats = fs.statSync(filePath);
            const size = getFileSize(filePath);
            const status = stats.size > 0 ? '✅' : '⚠️ ';

            console.log(`${status} ${fileName.padEnd(50)} ${size}`);

            if (stats.size === 0) {
                console.log(`   └─ Warning: File is empty!`);
                allPresent = false;
            } else {
                totalSize += stats.size;
            }
        } else {
            console.log(`❌ ${fileName.padEnd(50)} Missing`);
            allPresent = false;
        }
    }

    console.log('─'.repeat(80));

    if (allPresent) {
        console.log(`✅ All model files present! Total size: ${getFileSize(null, totalSize)}`);
        console.log('🚀 You can now run: npm run dev');
        return true;
    } else {
        console.log('❌ Some model files are missing or empty!');
        console.log('🚀 Run: npm run download-models');
        return false;
    }
}

// Override getFileSize for total calculation
function getFileSizeFromBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Check if script is run directly
if (require.main === module) {
    const success = checkModels();
    process.exit(success ? 0 : 1);
}

module.exports = { checkModels };