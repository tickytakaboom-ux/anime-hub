const quizGroups = {
  shonen: {
    title: "🔥 Shonen",
    desc: "Combats, dépassement et rivalités mythiques",
    quizzes: [
      { id: "onepiece", name: "One Piece" },
      { id: "aot", name: "Attack on Titan" },
      { id: "jjk", name: "Jujutsu Kaisen" },
      { id: "naruto", name: "Naruto" },
	  { id: "general", name: "General" }
    ]
  },

  seinen: {
    title: "🧠 Seinen",
    desc: "Histoires matures et psychologiques",
    quizzes: [
      { id: "deathnote", name: "Death Note" },
      { id: "monster", name: "Monster" }
    ]
  },

  classiques: {
    title: "📼 Classiques",
    desc: "Les piliers de l’histoire de l’animation japonaise",
    quizzes: [
      { id: "dbz", name: "Dragon Ball Z" },
      { id: "pokemon", name: "Pokémon" }
    ]
  },

  personnages: {
    title: "🎭 Personnages",
    desc: "Reconnais les figures emblématiques",
    quizzes: [
      { id: "luffy", name: "Monkey D. Luffy" },
      { id: "eren", name: "Eren Yeager" }
    ]
  }
};

const quizzes = {
  onepiece: [
	{
      question: "Quelle est la profession de Zoro dans l'équipage de Luffy ?",
      answers: ["Navigateur", "Médecin", "Cuisinier", "Epéiste"],
      correct: 3
    },
	{
      question: "Quel est le nom du second bateau de l'équipage de Luffy ?",
      answers: ["Red Sunny", "Vogue Merry", "Thousand Sunny", "Red Merry"],
      correct: 2
    },
	{
      question: "Comment s'appelle le premier Grand Corsaire que Luffy a affronté ?",
      answers: ["Crocodile", "Doflamingo", "Moria", "Mihawk"],
      correct: 0
    },
	{
      question: "Quel est le nom de l'île natale de Luffy ?",
      answers: ["Kuraigana", "Jaya", "Dawn", "Little East Blue"],
      correct: 2
    },
	{
      question: "Combien d'Amiraux sont présents simultanément ?",
      answers: ["8", "7", "3", "4"],
      correct: 2
    },
	{
      question: "Quel est le nom du continent situé au centre de Grand Line ?",
      answers: ["Red Line", "Mary Geoise", "East Blue", "Center Island"],
      correct: 0
    },
	{
      question: "Que fait Zoro lors de sa rencontre avec Tashigi ?",
      answers: ["Lui fait un croche pied", "Rigole d'elle", "Vole ses sabres", "Casse ses lunettes"],
      correct: 3
    },
	{
      question: "Quel plat Sanji a-t-il préparé pour Gin lors de leur première rencontre ?",
      answers: ["Risotto au fruit de mer", "Nouilles au poulet", "Soupe de poulet", "Calamar frit"],
      correct: 0
    },
	{
      question: "Quel personnage a réussi à s'échapper de Impel Down en se tranchant les jambes ?",
      answers: ["Shiki le tigre", "Shiki le géant", "Shiki le lion d'or", "Shiki le singe"],
      correct: 2
    },
	{
      question: "Quelle est la position de Charlotte Galette parmi les enfants de Big Mom",
      answers: ["11", "15", "18", "21"],
      correct: 2
    }
  ],

  aot: [
    {
      question: "Qui est le personnage principal de l'Attaque Des Titans ?",
      answers: ["Livai Ackerman", "Eren Jäger", "Armin Arlert"],
      correct: 1
    },
	{
      question: "Quel branche militaire est spécialisé dans les combats de Titans ?",
      answers: ["Bataillon d'exploration", "Police militaire", "Régiment de garnison"],
      correct: 0
    },
	{
      question: "Quel personnage est connu comme le Titan Bestial ?",
      answers: ["Livai Ackerman", "Sieg Jäger", "Kenny Ackerman"],
      correct: 1
    },
	{
      question: "Qui se transforme en Titan Femelle ?",
      answers: ["Annie Leonhart", "Mikasa Ackerman", "Sasha Braus"],
      correct: 0
    },
	{
      question: "Qui est le possesseur originel du Titan Assaillant avant Eren",
      answers: ["Erwin Smith", "Kenny Ackerman", "Grisha Jäger"],
      correct: 2
    },
	{
      question: "Quelle est la caractéristique qui définit Armin ?",
      answers: ["Force", "Intelligence", "Courage"],
      correct: 1
    },
	{
      question: "Qui est le commandant guerrier Mahr qui a élevé Reiner, Annie et Bertholdt ?",
      answers: ["Willy Tybur", "Theo Magath", "Commandant Mahr"],
      correct: 1
    },
	{
      question: "Qui est le premier possesseur d'un Titan dans l'histoire ?",
      answers: ["Ymir Fritz", "King Fritz", "Willy Tybur"],
      correct: 0
    },
	{
      question: "Quel est la capacité protectrice de la famille Ackerman ?",
      answers: ["Instinct de capitaine", "Fléau des Titans", "Lien des Ackerman"],
      correct: 2
    },
	{
      question: "De quel matériau sont faites les armes du Titan Marteau ?",
      answers: ["Fer", "Chair de Titan endurci", "Crystal de glace éclaté"],
      correct: 1
    },
  ],

  jjk: [
    {
      question: "Qui est le plus puissant exorciste ?",
      answers: ["Nanami", "Gojo", "Sukuna", "Geto"],
      correct: 1
    }
  ],

  naruto: [
    {
      question: "Qui est le 7e Hokage ?",
      answers: ["Minato", "Kakashi", "Naruto", "Sasuke"],
      correct: 2
    }
  ],

  general: [
    {
      question: "Quel anime est le plus long ?",
      answers: ["Naruto", "One Piece", "Bleach", "Dragon Ball"],
      correct: 1
    }
  ]
};

// Rendre accessibles partout
window.quizGroups = quizGroups;
window.quizzes = quizzes;
