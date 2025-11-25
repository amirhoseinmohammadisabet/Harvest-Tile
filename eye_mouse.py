import cv2
import mediapipe as mp
import pyautogui
import numpy as np

# 1. Setup
cam_w, cam_h = 640, 480           # Camera resolution
cap = cv2.VideoCapture(0)
cap.set(3, cam_w)
cap.set(4, cam_h)

mp_face_mesh = mp.solutions.face_mesh
face_mesh = mp_face_mesh.FaceMesh(
    max_num_faces=1, 
    refine_landmarks=True,
    min_detection_confidence=0.5,
    min_tracking_confidence=0.5
)

# Get your actual screen size (e.g., 1920 x 1080)
screen_w, screen_h = pyautogui.size()

print("Eye Mouse Active! Press 'q' to quit.")

while True:
    success, frame = cap.read()
    if not success:
        continue
    
    # Flip frame horizontally so left is left (mirror view)
    frame = cv2.flip(frame, 1)
    rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    
    output = face_mesh.process(rgb_frame)
    landmark_points = output.multi_face_landmarks
    
    frame_h, frame_w, _ = frame.shape

    if landmark_points:
        landmarks = landmark_points[0].landmark
        
        # 2. Focus on one eye (Right Eye works best for single-point control)
        # Landmark indices for the Right Eye iris roughly: 474-478
        # We use landmark 474 as a stable reference point
        for id, landmark in enumerate(landmarks[474:478]): 
            x = int(landmark.x * frame_w)
            y = int(landmark.y * frame_h)
            
            # Visual guide: draw the eye tracking points
            cv2.circle(frame, (x, y), 3, (0, 255, 0))
            
            # 3. The Logic: Move the Mouse
            if id == 1: # Pick one specific point to drive the mouse
                
                # SENSITIVITY ADJUSTMENT
                # We multiply coordinates to make the mouse faster/more sensitive
                # Without this, you can't reach the corners of the screen
                screen_x = screen_w / frame_w * x * 1.5 # 1.5 is a sensitivity gain
                screen_y = screen_h / frame_h * y * 1.5
                
                print(f"Moving to: {int(screen_x)}, {int(screen_y)}")
                # Move the mouse
                pyautogui.moveTo(screen_x, screen_y)

    cv2.imshow('Eye Controlled Mouse', frame)
    
    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()