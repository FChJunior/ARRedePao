import * as THREE from "three";
import { MindARThree } from "mindar-image-three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

// =======================
// Botão de iniciar (iOS compatibility)
// =======================
const startButton = document.getElementById("start-button");
let arStarted = false;

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
let animationClip; // 🎬 Guarda o clip para detectar loop

loader.load(
  "./assets/masterAnimationPadeirinho.glb",
  (gltf) => {
    const model = gltf.scene;
    model.scale.set(4, 4, 4);
    model.position.set(0, -0.1, 0);
    model.rotation.x = 0.9;

    // ❌ NÃO congele matrix em AR
    // model.matrixAutoUpdate = false;

    contentGroup.add(model);

    if (gltf.animations.length > 0) {
      mixer = new THREE.AnimationMixer(model);
      gltf.animations.forEach((clip) => {
        animationClip = clip; // Guarda referência do clip
        const action = mixer.clipAction(clip);
        action.play();
        action.paused = true; // 🎬 Começa pausado
        animationActions.push(action);
      });

      // 🔁 Escuta quando animação faz loop
      mixer.addEventListener("loop", () => {
        console.log("🔁 Animação fez loop");
        // Reinicia áudio do início
        audio.currentTime = 0;
        audio.play().catch((err) => {
          console.warn("⚠️ Áudio não pôde ser reproduzido:", err);
        });
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
// Áudio
// =======================
const audio = new Audio("./audios/paderin.mp3");
audio.loop = false; // ❌ Sem loop no áudio

// =======================
// Debug de target
// =======================
anchor.onTargetFound = () => {
  console.log("🎯 Target encontrado");

  // ▶️ Resume animação
  animationActions.forEach((action) => {
    action.paused = false;
  });

  // ▶️ Toca áudio (só se AR já foi iniciado)
  if (arStarted) {
    audio.play().catch((err) => {
      console.warn("⚠️ Áudio não pôde ser reproduzido:", err);
    });
  }
};

anchor.onTargetLost = () => {
  console.log("❌ Target perdido");

  // ⏸️ Pausa animação
  animationActions.forEach((action) => {
    action.paused = true;
  });

  // ⏸️ Pausa áudio
  audio.pause();
};

// =======================
// Botão iniciar AR
// =======================
startButton.addEventListener("click", async () => {
  try {
    // 🔓 Desbloqueia áudio (importante para iOS)
    await audio.play();
    audio.pause();
    audio.currentTime = 0;

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

    // ✅ Remove o botão
    startButton.classList.add("hidden");
    console.log("✅ AR iniciado com sucesso");
  } catch (error) {
    console.error("❌ Erro ao iniciar AR:", error);
    alert("Erro ao iniciar a experiência AR. Por favor, recarregue a página.");
  }
});

// =======================
// Suavização correta
// =======================
const smoothPosition = new THREE.Vector3();
const smoothQuaternion = new THREE.Quaternion();
const smoothingFactor = 0.15; // quanto menor, mais suave
