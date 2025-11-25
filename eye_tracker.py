import cv2
import mediapipe as mp
import numpy as np

# 1. Initialize MediaPipe Face Mesh
mp_face_mesh = mp.solutions.face_mesh
# refine_landmarks=True is CRITICAL - it enables the iris detection
face_mesh = mp_face_mesh.FaceMesh(
    max_num_faces=1,
    refine_landmarks=True,
    min_detection_confidence=0.5,
    min_tracking_confidence=0.5
)

# 2. Access the Webcam (0 usually refers to the default camera)
cap = cv2.VideoCapture(0)

print("Starting video stream... Press 'q' to quit.")

while cap.isOpened():
    success, image = cap.read()
    if not success:
        print("Ignoring empty camera frame.")
        continue

    # Flip the image horizontally for a later selfie-view display
    image = cv2.flip(image, 1)
    
    # Convert the BGR image to RGB (MediaPipe requires RGB)
    rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)

    # 3. Process the image to find landmarks
    results = face_mesh.process(rgb_image)

    # Get image dimensions for drawing
    img_h, img_w, _ = image.shape

    if results.multi_face_landmarks:
        for face_landmarks in results.multi_face_landmarks:
            
            # In MediaPipe Mesh, landmarks 468 (Left) and 473 (Right) are the Iris Centers
            left_iris = face_landmarks.landmark[473]
            right_iris = face_landmarks.landmark[468]

            # Convert normalized coordinates (0.0 - 1.0) to pixel coordinates
            cx_left, cy_left = int(left_iris.x * img_w), int(left_iris.y * img_h)
            cx_right, cy_right = int(right_iris.x * img_w), int(right_iris.y * img_h)

            # 4. Visualize the output
            # Draw yellow dots on the irises
            cv2.circle(image, (cx_left, cy_left), 5, (0, 255, 255), -1, cv2.LINE_AA)
            cv2.circle(image, (cx_right, cy_right), 5, (0, 255, 255), -1, cv2.LINE_AA)

            # Print coordinates to terminal (Optional: Comment out if too fast)
            print(f"Left Iris: ({left_iris.x:.2f}, {left_iris.y:.2f})")

    # Display the resulting frame
    cv2.imshow('Eye Tracking HCI Test', image)

    # Break loop with 'q' key
    if cv2.waitKey(5) & 0xFF == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()
