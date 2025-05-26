import gzip
import sqlite3
import os
from PlaybyPlayFetch import PlayByPlayFetch
from PlayerStatsFetch import PlayerStatsFetch
from ScheduleFetch import ScheduleFetch
from BoxScoreFetch import BoxScoreFetch
from tqdm import tqdm
import time

def decompress_database(input_path='docs/assets/c_nba_2025.db.gz', output_path='c_nba_2025.db'):
    """Decompress the gzipped database file"""
    with gzip.open(input_path, 'rb') as f_in:
        with open(output_path, 'wb') as f_out:
            f_out.write(f_in.read())
    return output_path

def compress_database(input_path='c_nba_2025.db', output_path='docs/assets/c_nba_2025.db.gz'):
    """Compress the database file back to gzip"""
    with open(input_path, 'rb') as f_in:
        with gzip.open(output_path, 'wb') as f_out:
            f_out.write(f_in.read())

def create_database(db_name='c_nba_2025.db'):
    """Connect to SQLite database (either existing or new)"""
    # Connect to SQLite database 
    conn = sqlite3.connect(db_name)
    cursor = conn.cursor()
    
    # Always create tables if they don't exist
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS Player (
        Rk INTEGER,
        Player TEXT,
        Age INTEGER,
        Tm TEXT,
        Pos TEXT,
        G INTEGER,
        GS INTEGER,
        MP REAL,
        FG REAL,
        FGA REAL,
        FG_percent REAL,
        ThreeP REAL,
        ThreePA REAL,
        ThreeP_percent REAL,
        TwoP REAL,
        TwoPA REAL,
        TwoP_percent REAL,
        eFG_percent REAL,
        FT REAL,
        FTA REAL,
        FT_percent REAL,
        ORB REAL,
        DRB REAL,
        TRB REAL,
        AST REAL,
        STL REAL,
        BLK REAL,
        TOV REAL,
        PF REAL,
        PTS REAL
        
    )
    ''')
    cursor.execute('''
    DROP TABLE Schedule
    ''')
    cursor.execute('''
    CREATE TABLE Schedule (
        Date TEXT,
        Start_Time TEXT,
        Visitor TEXT,
        Visitor_PTS INTEGER,
        Home TEXT,
        Home_PTS INTEGER,
        BoxScore TEXT ,
        Notes TEXT,
        Attendance INTEGER,
        LengthOfGame Text,
        Arena TEXT,
        Last_Updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    ''')
    
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS PlaybyPlay (
        Game_ID TEXT,
        Quarter TEXT,
        Time TEXT,
        Visitor_Action TEXT,
        Visitor_PTS INTEGER,
        Score TEXT,
        Home_PTS INTEGER,
        Home_Action TEXT,
        UNIQUE(Game_ID, Quarter, Time, Visitor_Action, Home_Action)
    )
    ''')
    
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS BoxScoreBasic (
        Game_ID TEXT,
        Team TEXT,
        Opponent TEXT,
        Game_Type TEXT,
        Period TEXT,  -- Added for quarter/half breakdown (Q1, Q2, H1, Q3, Q4, H2, Game)
        Player TEXT,
        Status TEXT,
        MP TEXT,
        FG INTEGER,
        FGA INTEGER,
        FG_percent REAL,
        ThreeP INTEGER,
        ThreePA INTEGER,
        ThreeP_percent REAL,
        FT INTEGER,
        FTA INTEGER,
        FT_percent REAL,
        ORB INTEGER,
        DRB INTEGER,
        TRB INTEGER,
        AST INTEGER,
        STL INTEGER,
        BLK INTEGER,
        TOV INTEGER,
        PF INTEGER,
        PTS INTEGER,
        GmSc REAL,    -- Game Score
        PlusMinus INTEGER,
        UNIQUE(Game_ID, Team, Player, Period)
    )
    ''')
    
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS BoxScoreAdvanced (
        Game_ID TEXT,
        Team TEXT,
        Opponent TEXT,
        Game_Type TEXT,
        Period TEXT,  -- Added for quarter/half breakdown
        Player TEXT,
        Status TEXT,
        MP TEXT,
        TS_percent REAL,
        eFG_percent REAL,
        ThreePAr REAL,
        FTr REAL,
        ORB_percent REAL,
        DRB_percent REAL,
        TRB_percent REAL,
        AST_percent REAL,
        STL_percent REAL,
        BLK_percent REAL,
        TOV_percent REAL,
        USG_percent REAL,
        ORtg INTEGER,
        DRtg INTEGER,
        BPM REAL,
        UNIQUE(Game_ID, Team, Player, Period)
    )
    ''')
    
    conn.commit()
    return conn, cursor

def update_player_data(cursor, data):
    """Update player stats, replacing existing records for current players"""
    # First clear existing player data to ensure we have current stats
    cursor.execute('DELETE FROM Player')
    
    # Skip header row and empty rows
    for row in data[1:]:
        if len(row) > 1 and row[0]!='Rk':  # Skip empty rows
            # Convert empty strings to None for numeric fields
            processed_row = [
                int(row[0]) if row[0] and row[0].isdigit() else None,  # Rk
                row[1],  # Player
                int(row[2]) if row[2] and row[2].replace('.', '').isdigit() else None,  # Age
                row[3],  # Tm
                row[4],  # Pos
                int(row[5]) if row[5] and row[5].replace('.', '').isdigit() else None,  # G
                int(row[6]) if row[6] and row[6].replace('.', '').isdigit() else None,  # GS
                float(row[7]) if row[7] else None,  # MP
                float(row[8]) if row[8] else None,  # FG
                float(row[9]) if row[9] else None,  # FGA
                float(row[10]) if row[10] else None,  # FG_percent
                float(row[11]) if row[11] else None,  # ThreeP
                float(row[12]) if row[12] else None,  # ThreePA
                float(row[13]) if row[13] else None,  # ThreeP_percent
                float(row[14]) if row[14] else None,  # TwoP
                float(row[15]) if row[15] else None,  # TwoPA
                float(row[16]) if row[16] else None,  # TwoP_percent
                float(row[17]) if row[17] else None,  # eFG_percent
                float(row[18]) if row[18] else None,  # FT
                float(row[19]) if row[19] else None,  # FTA
                float(row[20]) if row[20] else None,  # FT_percent
                float(row[21]) if row[21] else None,  # ORB
                float(row[22]) if row[22] else None,  # DRB
                float(row[23]) if row[23] else None,  # TRB
                float(row[24]) if row[24] else None,  # AST
                float(row[25]) if row[25] else None,  # STL
                float(row[26]) if row[26] else None,  # BLK
                float(row[27]) if row[27] else None,  # TOV
                float(row[28]) if row[28] else None,  # PF
                float(row[29]) if row[29] else None   # PTS
            ]
            
            try:
                cursor.execute('''
                INSERT INTO Player VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', processed_row)
            except sqlite3.IntegrityError as e:
                # This shouldn't happen since we cleared the table, but just in case
                print(f"Failed to insert player {processed_row[1]} : {str(e)}")

def update_schedule_data(cursor, data):
    """Update schedule data, preserving existing playbyplay and boxscore data"""
    for row in data:
        if len(row) >= 7:  # Ensure we have all required fields
            # Convert empty strings to None for numeric fields
            processed_row = [
                row[0],  # Date
                row[1] if len(row) > 1 else None,  # Start_Time
                row[2],  # Visitor
                int(row[3]) if row[3] and row[3].isdigit() else None,  # Visitor_PTS
                row[4],  # Home
                int(row[5]) if row[5] and row[5].isdigit() else None,  # Home_PTS
                row[6] if len(row) > 6 else None,  # BoxScore
                row[7] if len(row) > 7 else None,  # Notes
                int(row[8].replace(',', '')) if len(row) > 8 and row[8] and row[8].replace(',', '').isdigit() else None,  # Attendance
                row[9] if len(row) > 9 else None,   # LengthOfGame
                row[10] if len(row) > 10 else None   # Arena
            ]
            
            try:
                # Update or insert schedule record
                cursor.execute('''
                INSERT INTO Schedule 
                (Date, Start_Time, Visitor, Visitor_PTS, Home, Home_PTS, BoxScore, Notes, Attendance, LengthOfGame, Arena)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?,?)
                ''', processed_row)
            except sqlite3.IntegrityError as e:
                print(f"Failed to insert schedule {processed_row[1],processed_row[6]} : {str(e)}")
                

def is_game_processed(cursor, game_id):
    """Check if a game already has playbyplay and boxscore data"""
    # Check PlaybyPlay
    cursor.execute('SELECT 1 FROM PlaybyPlay WHERE Game_ID = ? LIMIT 1', (game_id,))
    has_playbyplay = cursor.fetchone() is not None
    
    # Check BoxScoreBasic
    cursor.execute('SELECT 1 FROM BoxScoreBasic WHERE Game_ID = ? LIMIT 1', (game_id,))
    has_boxscore = cursor.fetchone() is not None
    
    return has_playbyplay and has_boxscore

def insert_playbyplay_data(cursor, data):
    for row in data:
        if len(row) >= 7:  # Ensure we have all required fields
            game_id = row[-1]  # Last element is the token/game_id
            quarter = row[0]   # First element is the quarter/title
            
            processed_row = [
                game_id,
                quarter,
                row[1],  # Time
                row[2],  # Visitor_Action
                int(row[3][1:]) if row[3][1:] and row[3][1:].isdigit() else None,  # Visitor_PTS
                row[4],  # Score
                int(row[5][1:]) if row[5][1:] and row[5][1:].isdigit() else None,  # Home_PTS
                row[6]   # Home_Action
            ]
            
            try:
                cursor.execute('''
                INSERT OR IGNORE INTO PlaybyPlay VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ''', processed_row)
            except sqlite3.IntegrityError as e:
                print(f"Failed to insert PlayByPlay {processed_row} : {str(e)}")

def insert_boxscore_data(cursor, data):
    """Handle insertion of both basic and advanced boxscore data with period breakdown"""
    for table_key, rows in data.items():
        # Extract period information from table key
        parts = table_key.split('-')
        team = parts[1]
        period = parts[2]  # game, q1, q2, h1, etc.
        is_advanced = 'advanced' in table_key
        
        for row in rows:
            try:
                 
                # Common fields for both basic and advanced
                game_id = row[-1]
                player = row[0]
                status = row[-5]
                team = row[-4]
                opponent = row[-3]
                game_type = row[-2]
            
            
                if not is_advanced:
                    # Process basic boxscore data
                    processed_row = [
                        game_id,
                        team,
                        opponent,
                        game_type,
                        period.upper(),  # Q1, H1, GAME, etc.
                        player,
                        status,
                        row[1],  # MP
                        int(row[2]) if row [2] else None,  # FG
                        int(row[3]) if row [3] else None,  # FGA
                        float(row[4]) if row [4] else None,  # FG%
                        int(row[5]) if row [5] else None,  # 3P
                        int(row[6]) if row [6] else None,  # 3PA
                        float(row[7]) if row [7] else None,  # 3P%
                        int(row[8]) if row [8] else None,  # FT
                        int(row[9]) if row [9] else None,  # FTA
                        float(row[10]) if row [10] else None,  # FT%
                        int(row[11]) if row [11] else None,  # ORB
                        int(row[12]) if row [12] else None,  # DRB
                        int(row[13]) if row [13] else None,  # TRB
                        int(row[14]) if row [14] else None,  # AST
                        int(row[15]) if row [15] else None,  # STL
                        int(row[16]) if row [16] else None,  # BLK
                        int(row[17]) if row [17] else None,  # TOV
                        int(row[18]) if row [18] else None,  # PF
                        int(row[19]) if row [19] else None,  # PTS
                        float(row[20]) if (len(row) > 20 and row[20]) else None,  # GmSc
                        int(row[21]) if (len(row) > 21 and row[21]) else None  # +/-
                    ]
                    
                    cursor.execute('''
                    INSERT OR IGNORE INTO BoxScoreBasic VALUES (
                        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
                    )
                    ''', processed_row)
                
                else:
                    # Process advanced boxscore data
                    processed_row = [
                        game_id,
                        team,
                        opponent,
                        game_type,
                        period.upper(),  # Q1, H1, GAME, etc.
                        player,
                        status,
                        row[1],  # MP
                        float(row[2]) if row [2] else None,  # TS%
                        float(row[3]) if row [3] else None,  # eFG%
                        float(row[4]) if row [4] else None,  # 3PAr
                        float(row[5]) if row [5] else None,  # FTr
                        float(row[6]) if row [6] else None,  # ORB%
                        float(row[7]) if row [7] else None,  # DRB%
                        float(row[8]) if row [8] else None,  # TRB%
                        float(row[9]) if row [9] else None,  # AST%
                        float(row[10]) if row [10] else None,  # STL%
                        float(row[11]) if row [11] else None,  # BLK%
                        float(row[12]) if row [12] else None,  # TOV%
                        float(row[13]) if row [13] else None,  # USG%
                        float(row[14]) if row [14] else None,  # ORtg
                        float(row[15]) if row [15] else None,  # DRtg
                        float(row[16])if row [16] else None  # BPM
                    ]
                    
                    cursor.execute('''
                    INSERT OR IGNORE INTO BoxScoreAdvanced VALUES (
                        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,?
                    )
                    ''', processed_row)
                    
            except (sqlite3.Error, IndexError,ValueError) as e:
                print(f"Error inserting {table_key} data for {player}: {str(e)}")
                print(f"Problematic row: {row}")

def main():
    try:
        # Decompress the database
        db_path = decompress_database()
        
        # Create database connection
        conn, cursor = create_database(db_path)
    
        # Always update player data (stats change frequently)
        print("Updating player data...")
        player_data = PlayerStatsFetch()
        update_player_data(cursor, player_data)
        conn.commit()
        print(f"Updated {len(player_data)-1} player records (excluding header)")
        
        # Always update schedule data (new games added frequently)
        print("Updating schedule data...")
        schedule_data = ScheduleFetch()
        update_schedule_data(cursor, schedule_data)
        conn.commit()
        print(f"Updated {len(schedule_data)} schedule records")
        
        # Get games that have boxscores from the schedule
        cursor.execute('SELECT BoxScore FROM Schedule WHERE BoxScore IS NOT NULL')
        games_with_boxscores = [row[0] for row in cursor.fetchall()]
        
        print(f"\nFound {len(games_with_boxscores)} games with boxscores in schedule...")
        
        # Filter out games that are already fully processed
        games_to_process = []
        for boxscore_path in games_with_boxscores:
            game_token = boxscore_path.split('/')[-1].split('.')[0]
            if not is_game_processed(cursor, game_token):
                games_to_process.append(boxscore_path)
        
        print(f"Found {len(games_to_process)} new games to process...")
        
        # Process PlaybyPlay and BoxScore for each new game
        for boxscore_path in tqdm(games_to_process, desc="Processing new games"):
            
            try:
                # Extract game token from boxscore path
                game_token = boxscore_path.split('/')[-1].split('.')[0]
                if not game_token:
                    continue
                # Fetch and insert PlaybyPlay data
                playbyplay_data = PlayByPlayFetch(game_token)
                time.sleep(3)
                if isinstance(playbyplay_data, list):  # Check if we got data, not an error code
                    insert_playbyplay_data(cursor, playbyplay_data)
                
                # Fetch and insert BoxScore data
                boxscore_data = BoxScoreFetch(boxscore_path)
                time.sleep(3)
                if isinstance(boxscore_data, dict):  # Check if we got data, not an error code
                    insert_boxscore_data(cursor, boxscore_data)
                
                # Commit after each game to save progress
                conn.commit()
                print("SUCCESS: ",game_token)
                time.sleep(0.1)
                
            except Exception as e:
                print(f"ERROR: {game_token} {boxscore_path} | {str(e)}")
                conn.rollback()  # Rollback in case of error
                time.sleep(5)  # Longer delay after error
        
        conn.commit()
        conn.close()
        # Compress the updated database back
        compress_database()
        
        print("\nDatabase update complete!")
    
    except Exception as e:
        print(f"Error during database update: {str(e)}")
        raise
    
    # Close the connection
    conn.close()
    print("\nDatabase update complete!")

if __name__ == "__main__":
    main()


    
    
   

