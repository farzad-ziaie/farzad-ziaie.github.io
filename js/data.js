const WEBSITE_DATA = {
    // Research Highlights
    highlights: [
        {
            id: "pose3d",
            title: "High‑Resolution Markerless 3D Pose Estimation",
            icon: "fa-cube",
            image: "images/pose3d.png",
            description:
                "A state‑of‑the‑art multi‑camera deep learning system for high‑resolution, markerless 3D pose estimation in freely behaving animals. Built using synchronized Basler cameras, custom calibration pipelines, and optimized CNN architectures. Achieved one of the most efficient animal‑tracking systems worldwide.",
            tags: ["Computer Vision", "3D Reconstruction", "Deep Learning"],
            links: []
        },
        {
            id: "multiview-clustering",
            title: "Multi‑View Video–Image Clustering",
            icon: "fa-layer-group",
            image: "images/multiview.png",
            description:
                "A highly optimized multi‑view clustering pipeline using NVIDIA DALI for large‑scale video datasets. Designed for fast labeling, high‑dimensional feature extraction, and efficient 3D behavioral data organization.",
            tags: ["NVIDIA DALI", "Clustering", "High‑Dimensional Data"],
            links: []
        },
        {
            id: "rag-legal-assistant",
            title: "RAG‑Based Legal Assistant",
            icon: "fa-scale-balanced",
            image: "images/rag.png",
            description:
                "A Retrieval‑Augmented Generation (RAG) system for legal document question answering. Built robust pipelines for document ingestion, chunking, vector search, and LLM‑based reasoning.",
            tags: ["RAG", "NLP", "Document AI"],
            links: []
        },
        {
            id: "behavior-analysis",
            title: "Real‑Time Behavioral Analysis",
            icon: "fa-brain",
            image: "images/behavior.png",
            description:
                "Developed real‑time monitoring tools for animal behavior and wellbeing using 3D reconstructed images, outlier detection, and automated movement analysis.",
            tags: ["Computer Vision", "Behavior Analysis", "Neuroscience"],
            links: []
        },
        {
            id: "biomedical-ml",
            title: "Biomedical Machine Learning Projects",
            icon: "fa-heartbeat",
            image: "images/biomed.png",
            description:
                "A collection of biomedical ML systems including PPG→ABP mapping, arrhythmia detection, EMG‑based force modeling, and breast‑cancer image segmentation.",
            tags: ["Biomedical ML", "Signal Processing", "Neural Networks"],
            links: []
        }
    ],

    // Publications
    publications: [
        {
            year: 2021,
            title: "Automatic Classification Between COVID‑19 and Non‑COVID Pneumonia",
            authors: [
                { name: "H. R. Marateb", isMe: false },
                { name: "Farzad Ziaie Nezhad", isMe: true },
                { name: "M. R. Mohebian", isMe: false },
                { name: "R. Sami", isMe: false }
            ],
            venue: "Frontiers in Medicine",
            links: []
        },
        {
            year: 2020,
            title: "Epileptic Seizure Prediction and Onset Zone Localization",
            authors: [
                { name: "H. R. Marateb", isMe: false },
                { name: "Farzad Ziaie Nezhad", isMe: true }
            ],
            venue: "Modelling and Analysis of Active Biopotential Signals in Healthcare",
            links: []
        },
        {
            year: 2020,
            title: "Prosthesis Control Using Undersampled Surface EMG Signals",
            authors: [
                { name: "H. R. Marateb", isMe: false },
                { name: "Farzad Ziaie Nezhad", isMe: true }
            ],
            venue: "CRC Press – Analysis of Medical Modalities",
            links: []
        }
    ],
};
