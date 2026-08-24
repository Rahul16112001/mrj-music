package com.mrj.music.di

import android.content.Context
import androidx.room.Room
import com.mrj.music.data.local.AppDatabase
import com.mrj.music.data.local.daos.*
import com.mrj.music.data.preferences.DataStoreManager
import com.mrj.music.data.remote.api.MRJApiService
import com.mrj.music.data.repository.AuthRepository
import com.mrj.music.data.repository.MusicRepository
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object DatabaseModule {

    @Provides
    @Singleton
    fun provideAppDatabase(@ApplicationContext context: Context): AppDatabase {
        return Room.databaseBuilder(
            context.applicationContext,
            AppDatabase::class.java,
            "mrj_music_db"
        ).fallbackToDestructiveMigration().build()
    }

    @Provides
    @Singleton
    fun provideDownloadedTrackDao(db: AppDatabase): DownloadedTrackDao = db.downloadedTrackDao()

    @Provides
    @Singleton
    fun provideLikedTrackDao(db: AppDatabase): LikedTrackDao = db.likedTrackDao()

    @Provides
    @Singleton
    fun providePlaylistDao(db: AppDatabase): PlaylistDao = db.playlistDao()

    @Provides
    @Singleton
    fun providePlaylistTrackDao(db: AppDatabase): PlaylistTrackDao = db.playlistTrackDao()

    @Provides
    @Singleton
    fun provideSearchHistoryDao(db: AppDatabase): SearchHistoryDao = db.searchHistoryDao()

    @Provides
    @Singleton
    fun provideDataStoreManager(@ApplicationContext context: Context): DataStoreManager {
        return DataStoreManager.getInstance(context)
    }

    @Provides
    @Singleton
    fun provideAuthRepository(
        apiService: MRJApiService,
        dataStoreManager: DataStoreManager
    ): AuthRepository {
        return AuthRepository(apiService, dataStoreManager)
    }

    @Provides
    @Singleton
    fun provideMusicRepository(
        apiService: MRJApiService,
        downloadedTrackDao: DownloadedTrackDao,
        likedTrackDao: LikedTrackDao,
        playlistDao: PlaylistDao,
        playlistTrackDao: PlaylistTrackDao,
        searchHistoryDao: SearchHistoryDao,
        dataStoreManager: DataStoreManager
    ): MusicRepository {
        return MusicRepository(apiService, downloadedTrackDao, likedTrackDao, playlistDao, playlistTrackDao, searchHistoryDao, dataStoreManager)
    }
}
