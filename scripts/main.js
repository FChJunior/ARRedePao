import * as THREE from "three";
import { MindARThree } from "mindar-image-three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

// =======================
// Botão de iniciar (iOS compatibility)
// =======================
const startButton = document.getElementById("start-button");
let arStarted = false;
let firstTargetDetection = true; // Flag para primeira detecção do target

// =======================
// Controles AR
// =======================
const arControls = document.getElementById("ar-controls");
const rotateXUpBtn = document.getElementById("rotate-x-up");
const rotateXDownBtn = document.getElementById("rotate-x-down");
const rotateYLeftBtn = document.getElementById("rotate-y-left");
const rotateYRightBtn = document.getElementById("rotate-y-right");
const zoomInBtn = document.getElementById("zoom-in");
const zoomOutBtn = document.getElementById("zoom-out");

// Variáveis de controle
let modelRotationX = 0; // Rotação adicional no eixo X
let modelRotationY = 0; // Rotação adicional no eixo Y
let modelScale = 4; // Escala inicial do modelo

// =======================
// MindAR setup
// =======================
const mindarThree = new MindARThree({
  container: document.body,
  imageTargetSrc: "./target/targets.mind",
});

const { renderer, scene, camera } = mindarThree;
renderer.setClearColor(0x000000, 0);
scene.add(camera);

// =======================
// Luz
// =======================
const light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1);
scene.add(light);

// =======================
// Anchor
// =======================
const anchor = mindarThree.addAnchor(0);

// ⚠️ Grupo intermediário (MUITO IMPORTANTE)
const contentGroup = new THREE.Group();
anchor.group.add(contentGroup);

// =======================
// Modelo 3D
// =======================
const loader = new GLTFLoader();
const clock = new THREE.Clock();
let mixer;
let animationActions = [];
let model; // Referência global do modelo

loader.load(
  "./assets/masterAnimationPadeirinho.glb",
  (gltf) => {
    model = gltf.scene;
    model.scale.set(4, 4, 4);
    model.position.set(0, -0.1, 0);
    model.rotation.x = 0.9;

    // ❌ NÃO congele matrix em AR
    // model.matrixAutoUpdate = false;

    contentGroup.add(model);

    if (gltf.animations.length > 0) {
      mixer = new THREE.AnimationMixer(model);
      gltf.animations.forEach((clip) => {
        const action = mixer.clipAction(clip);
        action.play();
        action.paused = true; // 🎬 Começa pausado
        animationActions.push(action);
      });

      // 🔁 Escuta quando animação faz loop
      mixer.addEventListener("loop", () => {
        console.log("🔁 Animação fez loop");
        // Reinicia áudio do paderin do início
        audioPaderin.currentTime = 0;
        audioPaderin.play().catch((err) => {
          console.warn("⚠️ Áudio paderin não pôde ser reproduzido:", err);
        });
        // Reinicia áudio dos efeitos com 2 segundos de atraso
        audioEfeitos.currentTime = 2;
        audioEfeitos.play().catch((err) => {
          console.warn("⚠️ Áudio efeitos não pôde ser reproduzido:", err);
        });
        // Marca para próxima detecção continuar de onde parou
        firstTargetDetection = false;
      });
    }

    console.log("✅ Modelo carregado com sucesso");
  },
  undefined,
  (error) => {
    console.error("❌ Erro ao carregar modelo:", error);
  }
);

// =======================
// Áudios
// =======================
const audioPaderin = new Audio("./audios/paderin.mp3");
audioPaderin.loop = false; // ❌ Sem loop no áudio

const audioEfeitos = new Audio("./audios/efeitos.mp3");
audioEfeitos.loop = false; // ❌ Sem loop no áudio (sincroniza com animação)

// =======================
// Debug de target
// =======================
anchor.onTargetFound = () => {
  console.log("🎯 Target encontrado");

  // ▶️ Resume animação
  animationActions.forEach((action) => {
    action.paused = false;
  });

  // ▶️ Toca ambos os áudios (só se AR já foi iniciado)
  if (arStarted) {
    audioPaderin.play().catch((err) => {
      console.warn("⚠️ Áudio paderin não pôde ser reproduzido:", err);
    });

    // Na primeira vez, começa em 2s. Depois, continua de onde parou
    if (firstTargetDetection) {
      audioEfeitos.currentTime = 2;
      firstTargetDetection = false;
    }

    audioEfeitos.play().catch((err) => {
      console.warn("⚠️ Áudio efeitos não pôde ser reproduzido:", err);
    });
  }
};

anchor.onTargetLost = () => {
  console.log("❌ Target perdido");

  // ⏸️ Pausa animação
  animationActions.forEach((action) => {
    action.paused = true;
  });

  // ⏸️ Pausa ambos os áudios
  audioPaderin.pause();
  audioEfeitos.pause();
};

// =======================
// Botão iniciar AR
// =======================
startButton.addEventListener("click", async () => {
  try {
    // 🔓 Desbloqueia ambos os áudios (importante para iOS)
    await audioPaderin.play();
    audioPaderin.pause();
    audioPaderin.currentTime = 0;

    await audioEfeitos.play();
    audioEfeitos.pause();
    audioEfeitos.currentTime = 0;

    // 🚀 Inicia o MindAR
    await mindarThree.start();
    arStarted = true;

    // 🎬 Inicia o loop de renderização
    renderer.setAnimationLoop(() => {
      const delta = clock.getDelta();

      if (mixer) mixer.update(delta);

      // 👉 Copia o tracking do anchor com suavização
      smoothPosition.lerp(anchor.group.position, smoothingFactor);
      smoothQuaternion.slerp(anchor.group.quaternion, smoothingFactor);

      // 👉 Aplica SOMENTE no conteúdo
      contentGroup.position.copy(smoothPosition);
      contentGroup.quaternion.copy(smoothQuaternion);

      renderer.render(scene, camera);
    });

    // ✅ Remove o botão e mostra controles
    startButton.classList.add("hidden");
    arControls.classList.remove("hidden");
    console.log("✅ AR iniciado com sucesso");
  } catch (error) {
    console.error("❌ Erro ao iniciar AR:", error);
    alert("Erro ao iniciar a experiência AR. Por favor, recarregue a página.");
  }
});

// =======================
// Event Listeners dos Controles
// =======================

// Rotação X para cima (↑)
rotateXUpBtn.addEventListener("click", () => {
  if (model) {
    modelRotationX -= Math.PI / 4; // Rotaciona 45 graus para cima
    model.rotation.x = 0.9 + modelRotationX; // Mantém rotação inicial + adicional
  }
});

// Rotação X para baixo (↓)
rotateXDownBtn.addEventListener("click", () => {
  if (model) {
    modelRotationX += Math.PI / 4; // Rotaciona 45 graus para baixo
    model.rotation.x = 0.9 + modelRotationX; // Mantém rotação inicial + adicional
  }
});

// Rotação Y para esquerda (←)
rotateYLeftBtn.addEventListener("click", () => {
  if (model) {
    modelRotationY -= Math.PI / 4; // Rotaciona 45 graus para esquerda
    model.rotation.y = modelRotationY;
  }
});

// Rotação Y para direita (→)
rotateYRightBtn.addEventListener("click", () => {
  if (model) {
    modelRotationY += Math.PI / 4; // Rotaciona 45 graus para direita
    model.rotation.y = modelRotationY;
  }
});

// Zoom In
zoomInBtn.addEventListener("click", () => {
  if (model) {
    modelScale += 0.5;
    if (modelScale > 8) modelScale = 8; // Limite máximo
    model.scale.set(modelScale, modelScale, modelScale);
  }
});

// Zoom Out
zoomOutBtn.addEventListener("click", () => {
  if (model) {
    modelScale -= 0.5;
    if (modelScale < 2) modelScale = 2; // Limite mínimo
    model.scale.set(modelScale, modelScale, modelScale);
  }
});

// =======================
// Suavização correta
// =======================
const smoothPosition = new THREE.Vector3();
const smoothQuaternion = new THREE.Quaternion();
const smoothingFactor = 0.15; // quanto menor, mais suave
