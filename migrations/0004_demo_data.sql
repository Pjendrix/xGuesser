INSERT OR REPLACE INTO users (id, email, display_name, avatar_url, is_admin) VALUES ('demo-01','demo01@example.invalid','Tomáš H.',NULL,0),('demo-02','demo02@example.invalid','Jana P.',NULL,0),('demo-03','demo03@example.invalid','Martin K.',NULL,0),('demo-04','demo04@example.invalid','Lucie N.',NULL,0),('demo-05','demo05@example.invalid','Ondřej V.',NULL,0);

INSERT OR REPLACE INTO gameweeks (id, season, deadline, status, featured_player_id) VALUES (1,'2026/27','2026-08-14T18:00:00Z','settled',NULL),(2,'2026/27','2026-08-22T11:30:00Z','settled',NULL);

INSERT OR REPLACE INTO scores (gameweek_id, category, user_id, abs_diff, signed_diff, "rank", points) VALUES (1,'featured','demo-01',0.04,0.04,1,5),(1,'featured','demo-03',0.09,-0.09,2,4),(1,'featured','demo-02',0.14,0.14,3,3),(1,'featured','demo-05',0.21,-0.21,4,2),(1,'featured','demo-04',0.33,0.33,5,1);

INSERT OR REPLACE INTO scores (gameweek_id, category, user_id, abs_diff, signed_diff, "rank", points) VALUES (2,'featured','demo-02',0.02,0.02,1,5),(2,'featured','demo-01',0.07,0.07,2,4),(2,'featured','demo-04',0.11,-0.11,3,3),(2,'featured','demo-03',0.19,0.19,4,2),(2,'featured','demo-05',0.28,-0.28,5,1);

INSERT OR REPLACE INTO scores (gameweek_id, category, user_id, abs_diff, signed_diff, "rank", points) VALUES (1,'player','demo-05',0.06,0.06,1,5),(1,'player','demo-02',0.10,0.10,2,4),(1,'player','demo-01',0.13,-0.13,3,3),(1,'player','demo-04',0.24,0.24,4,2),(1,'player','demo-03',0.31,-0.31,5,1);

INSERT OR REPLACE INTO scores (gameweek_id, category, user_id, abs_diff, signed_diff, "rank", points) VALUES (2,'player','demo-01',0.03,0.03,1,5),(2,'player','demo-05',0.08,-0.08,2,4),(2,'player','demo-03',0.12,0.12,3,3),(2,'player','demo-02',0.20,0.20,4,2),(2,'player','demo-04',0.29,-0.29,5,1);

INSERT OR REPLACE INTO scores (gameweek_id, category, user_id, abs_diff, signed_diff, "rank", points) VALUES (1,'team','demo-03',0.11,0.11,1,5),(1,'team','demo-01',0.18,-0.18,2,4),(1,'team','demo-04',0.27,0.27,3,3),(1,'team','demo-02',0.44,0.44,4,2),(1,'team','demo-05',0.61,-0.61,5,1);

INSERT OR REPLACE INTO scores (gameweek_id, category, user_id, abs_diff, signed_diff, "rank", points) VALUES (2,'team','demo-04',0.09,0.09,1,5),(2,'team','demo-03',0.16,0.16,2,4),(2,'team','demo-01',0.22,-0.22,3,3),(2,'team','demo-05',0.38,0.38,4,2),(2,'team','demo-02',0.55,-0.55,5,1);
