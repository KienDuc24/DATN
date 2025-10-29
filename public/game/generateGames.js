const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const gameRoot = path.join(__dirname, 'public', 'game');
const outputFile = path.join(__dirname, 'public', 'games.json');

function getLogoPath(gameFolder) {
  const imgFolder = path.join(gameFolder, 'Img');
  if (!fs.existsSync(imgFolder)) return '';
  const files = fs.readdirSync(imgFolder);
  const logoFile = files.find(f =>
    /^logo\.(png|jpg|jpeg|gif|webp|svg)$/i.test(f)
  );
  return logoFile ? `/game/${path.basename(gameFolder)}/Img/${logoFile}` : '🎮';
}

function getGameInfo(gameFolder) {
  const inforPath = path.join(gameFolder, 'infor.json');
  if (!fs.existsSync(inforPath)) return null;
  const raw = fs.readFileSync(inforPath, 'utf8').trim();
  let infoArr;
  try {
    infoArr = JSON.parse(raw);
  } catch (e) {
    console.error('JSON parse error in', inforPath);
    return null;
  }
  if (!Array.isArray(infoArr) || !infoArr[0]) return null;
  const info = infoArr[0];
  return {
    name: info.name || '',
    desc: info.desc || '',
    players: info.players || '',
    iconPath: getLogoPath(gameFolder),
    id: info.id || '',
    category: info.category || '',
  };
}

const games = [];
console.log('🔍 Scanning game directory...');

fs.readdirSync(gameRoot).forEach(sub => {
  const gameFolder = path.join(gameRoot, sub);
  if (fs.statSync(gameFolder).isDirectory()) {
    console.log(`📁 Found game folder: ${sub}`);
    const info = getGameInfo(gameFolder);
    if (info) {
      games.push(info);
      console.log(`✅ Added game: ${info.name} (${info.players} players)`);
    } else {
      console.log(`❌ Skipped ${sub}: missing or invalid infor.json`);
    }
  }
});

fs.writeFileSync(outputFile, JSON.stringify(games, null, 2), 'utf8');
console.log(`\n🎮 Generated games.json with ${games.length} games:`);
games.forEach((game, index) => {
  console.log(`  ${index + 1}. ${game.name} - ${game.players} players`);
});